import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler


# ═══════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════

def _is_ev(category):
    """Cek apakah kategori kendaraan adalah EV murni."""
    return str(category).strip().upper() == 'EV'


def _is_hybrid(category):
    """Cek apakah kategori kendaraan adalah Hybrid."""
    return 'HYBRID' in str(category).strip().upper()


def _safe_minmax(series, invert=False):
    """MinMaxScaler yang aman dari division-by-zero.
    
    Jika semua nilai identik (range = 0), return 0.5 (skor netral)
    agar tidak menghasilkan NaN atau bias terhadap kelompok tertentu.
    
    Args:
        series: Pandas Series berisi nilai numerik
        invert: Jika True, skor dibalik (nilai rendah → skor tinggi)
    Returns:
        Pandas Series dengan nilai 0.0 - 1.0
    """
    smin, smax = series.min(), series.max()
    if smax == smin:
        return pd.Series(0.5, index=series.index)
    scaled = (series - smin) / (smax - smin)
    return (1 - scaled) if invert else scaled


def _safe_float(val, default=0.0):
    """Konversi aman ke float, replace NaN/Inf dengan default."""
    try:
        f = float(val)
        if f != f or f == float('inf') or f == float('-inf'):
            return default
        return round(f, 1)
    except (TypeError, ValueError):
        return default


def get_eco_grade(co2_emission):
    """Mengubah emisi CO2 menjadi Eco Grade (A-F)"""
    if co2_emission == 0:
        return 'A+'
    elif co2_emission <= 150:
        return 'A'
    elif co2_emission <= 250:
        return 'B'
    elif co2_emission <= 350:
        return 'C'
    elif co2_emission <= 450:
        return 'D'
    else:
        return 'F'


# ═══════════════════════════════════════════════════════════════
#  DATA LOADING & PREPROCESSING
# ═══════════════════════════════════════════════════════════════

def load_and_prep_data(filepath="data/EV_vs_ICE_Vehicle_Specs_2015_2026.csv"):
    """Memuat, membersihkan, dan melakukan feature engineering pada dataset.
    
    Pipeline:
    1. Load CSV dengan error handling
    2. Validasi kolom wajib
    3. Deduplikasi Make+Model+Year
    4. Imputasi missing values (median per kategori)
    5. Feature engineering (CO2 tahunan, range, eco grade, dll)
    6. Within-group normalization (agar EV vs EV dan ICE vs ICE adil)
    
    Args:
        filepath: Path ke file CSV dataset
    Returns:
        DataFrame yang sudah dipreproses dan dinormalisasi
    """
    # -------------------------------------------------
    # 0. ERROR HANDLING — Load & Validasi
    # -------------------------------------------------
    try:
        df = pd.read_csv(filepath)
    except FileNotFoundError:
        raise FileNotFoundError(
            f"[ERROR] Dataset tidak ditemukan: '{filepath}'. "
            f"Pastikan file CSV ada di lokasi yang benar."
        )
    except pd.errors.EmptyDataError:
        raise ValueError(
            f"[ERROR] File CSV kosong: '{filepath}'."
        )
    except Exception as e:
        raise RuntimeError(
            f"[ERROR] Gagal membaca dataset: {e}"
        )

    required_cols = [
        'Make', 'Model', 'Year', 'Vehicle_Category',
        'City_MPG', 'Highway_MPG', 'Combined_MPG',
        'CO2_Emissions_g_per_mile', 'EV_Range_miles',
        'Engine_Size_L', 'Engine_Cylinders',
        'Drivetrain', 'Transmission'
    ]
    missing_cols = [c for c in required_cols if c not in df.columns]
    if missing_cols:
        raise KeyError(
            f"[ERROR] Kolom wajib tidak ditemukan di dataset: {missing_cols}"
        )

    # -------------------------------------------------
    # 1. DEDUPLIKASI — Ambil trim terbaik per Make+Model+Year
    # -------------------------------------------------
    # Banyak kendaraan muncul berulang (varian trim berbeda).
    # Untuk rekomendasi, kita ambil yang paling efisien (Combined_MPG tertinggi).
    df = df.sort_values('Combined_MPG', ascending=False)
    df = df.drop_duplicates(subset=['Make', 'Model', 'Year'], keep='first')
    df = df.reset_index(drop=True)

    # -------------------------------------------------
    # 2. IMPUTASI MISSING VALUES (MEDIAN per Kategori)
    # -------------------------------------------------
    cols_to_fill = ['City_MPG', 'Highway_MPG', 'CO2_Emissions_g_per_mile']

    for col in cols_to_fill:
        # Mengisi nilai kosong dengan median dari masing-masing kategori (EV atau ICE)
        df[col] = df[col].fillna(
            df.groupby('Vehicle_Category')[col].transform('median')
        )
        # Berjaga-jaga jika ada kategori yang seluruh datanya kosong
        df[col] = df[col].fillna(df[col].median())

    # Imputasi kolom mesin untuk kendaraan non-EV
    df['Engine_Size_L'] = df['Engine_Size_L'].fillna(0.0)
    df['Engine_Cylinders'] = df['Engine_Cylinders'].fillna(0.0)

    # -------------------------------------------------
    # 3. FEATURE ENGINEERING
    # -------------------------------------------------

    # 3a. Jejak Karbon Tahunan (Asumsi 15.000 mil per tahun)
    df['Annual_CO2_Footprint_kg'] = (
        df['CO2_Emissions_g_per_mile'] * 15000
    ) / 1000

    # 3b. Rasio Efisiensi Kota vs Tol (dengan proteksi division by zero)
    df['Highway_MPG'] = df['Highway_MPG'].replace(0, 0.1)
    df['City_Highway_Ratio'] = df['City_MPG'] / df['Highway_MPG']

    # 3c. Jarak Tempuh Terpadu (Unified Range)
    #     - EV murni: gunakan EV Range
    #     - Hybrid: gabungkan bensin (Combined MPG × 14 galon) + baterai EV
    #     - ICE/CNG: hanya bensin (Combined MPG × 14 galon)
    def _calc_unified_range(row):
        cat = str(row['Vehicle_Category']).strip().upper()
        ev_range = row['EV_Range_miles'] if pd.notnull(row['EV_Range_miles']) else 0
        fuel_range = row['Combined_MPG'] * 14  # asumsi tangki 14 galon

        if cat == 'EV':
            return ev_range
        elif 'HYBRID' in cat:
            return fuel_range + ev_range
        else:
            return fuel_range

    df['Unified_Range_Miles'] = df.apply(_calc_unified_range, axis=1)

    # 3d. Eco Grade Rating
    df['Eco_Grade'] = df['CO2_Emissions_g_per_mile'].apply(get_eco_grade)

    # 3e. Profil Mesin & Performa
    def _engine_profile(row):
        if _is_ev(row['Vehicle_Category']):
            return "Motor Listrik"
        elif _is_hybrid(row['Vehicle_Category']):
            cyl = int(row['Engine_Cylinders']) if pd.notnull(row['Engine_Cylinders']) else 0
            size = row['Engine_Size_L'] if pd.notnull(row['Engine_Size_L']) else 0
            return f"{size}L {cyl}-Sil + Motor"
        else:
            cyl = int(row['Engine_Cylinders']) if pd.notnull(row['Engine_Cylinders']) else 0
            size = row['Engine_Size_L'] if pd.notnull(row['Engine_Size_L']) else 0
            return f"{size}L {cyl}-Silinder"

    df['Engine_Profile'] = df.apply(_engine_profile, axis=1)

    # 3f. Klasifikasi Drivetrain & Transmisi
    def _classify_drive(x):
        s = str(x) if pd.notnull(x) else ""
        if "All-Wheel" in s or "4-Wheel" in s:
            return "AWD/4WD"
        elif "Front" in s:
            return "FWD"
        else:
            return "RWD"

    df['Drive_Type'] = df['Drivetrain'].apply(_classify_drive)
    df['Transmission_Type'] = df['Transmission'].apply(
        lambda x: "Manual" if pd.notnull(x) and "Manual" in str(x)
        else "Automatic"
    )

    # 3g. Performance Proxy — Lebih granular
    #     - EV: gunakan EV_Range (range besar = baterai besar = power lebih)
    #     - ICE: gunakan Engine_Size_L
    #     - Fallback: 1.5 (rata-rata kecil)
    def _perf_proxy(row):
        if _is_ev(row['Vehicle_Category']):
            return row['EV_Range_miles'] if row['EV_Range_miles'] > 0 else 200.0
        else:
            size = row['Engine_Size_L']
            if pd.notnull(size) and size > 0:
                return size
            return 1.5

    df['Perf_Proxy'] = df.apply(_perf_proxy, axis=1)

    # -------------------------------------------------
    # 4. NORMALISASI (WITHIN-GROUP SCALING)
    # -------------------------------------------------
    # Normalisasi dilakukan PER KATEGORI kendaraan agar:
    # - EV dibandingkan sesama EV → slider user bermakna
    # - ICE dibandingkan sesama ICE → ranking adil
    # - Tidak ada kategori yang "pasti menang" karena unit berbeda (MPGe vs MPG)
    
    score_configs = [
        ('Score_Eco',   'CO2_Emissions_g_per_mile', True),   # rendah = bagus
        ('Score_City',  'City_MPG',                 False),  # tinggi = bagus
        ('Score_Hwy',   'Highway_MPG',              False),  # tinggi = bagus
        ('Score_Range', 'Unified_Range_Miles',       False),  # tinggi = bagus
        ('Score_Perf',  'Perf_Proxy',               False),  # tinggi = bagus
    ]

    for col_score, col_raw, invert in score_configs:
        df[col_score] = df.groupby('Vehicle_Category')[col_raw].transform(
            lambda s: _safe_minmax(s, invert=invert)
        )

    return df


# ═══════════════════════════════════════════════════════════════
#  DATASET STATISTICS (Landing Page)
# ═══════════════════════════════════════════════════════════════

def get_dataset_stats(df):
    """Menghitung statistik global dataset untuk landing page."""
    total_vehicles = len(df)
    total_ev = int(
        df['Vehicle_Category'].str.contains('EV', case=False, na=False).sum()
    )
    total_ice = total_vehicles - total_ev
    avg_co2 = round(df['CO2_Emissions_g_per_mile'].mean(), 0)
    avg_mpg = round(df['Combined_MPG'].mean(), 1)
    total_makes = df['Make'].nunique()
    year_range_min = int(df['Year'].min())
    year_range_max = int(df['Year'].max())
    zero_emission_count = int((df['CO2_Emissions_g_per_mile'] == 0).sum())

    return {
        'total_vehicles': total_vehicles,
        'total_ev': total_ev,
        'total_ice': total_ice,
        'avg_co2': avg_co2,
        'avg_mpg': avg_mpg,
        'total_makes': total_makes,
        'year_min': year_range_min,
        'year_max': year_range_max,
        'zero_emission': zero_emission_count,
    }


# ═══════════════════════════════════════════════════════════════
#  RECOMMENDATION ENGINE (MCDM)
# ═══════════════════════════════════════════════════════════════

def get_recommendations(df, min_year, fuel_pref, city_ratio, eco_priority, top_n=6):
    """Menghasilkan rekomendasi kendaraan berdasarkan preferensi user.
    
    Pipeline:
    1. Rule-Based Filtering (tahun, kategori)
    2. Pembobotan MCDM dengan floor minimum per dimensi
    3. Scoring & ranking
    4. KPI executive summary
    5. Chart data untuk visualisasi
    
    Args:
        df: DataFrame yang sudah dipreproses
        min_year: Tahun minimum kendaraan
        fuel_pref: "All", "EV Only", atau "ICE Only"
        city_ratio: Rasio berkendara kota (0.0 = full tol, 1.0 = full kota)
        eco_priority: Prioritas lingkungan (0.0 = efisiensi, 1.0 = eco)
        top_n: Jumlah rekomendasi
    Returns:
        Tuple (result_df, kpi_data, chart_data)
    """
    # -------------------------------------------------
    # Tahap 1: Rule-Based Filtering
    # -------------------------------------------------
    filtered = df[df['Year'] >= min_year].copy()

    if fuel_pref == "EV Only":
        filtered = filtered[
            filtered['Vehicle_Category'].str.contains('EV', case=False, na=False)
        ]
    elif fuel_pref == "ICE Only":
        filtered = filtered[
            ~filtered['Vehicle_Category'].str.contains('EV', case=False, na=False) &
            ~filtered['Vehicle_Category'].str.contains('Hybrid', case=False, na=False)
        ]

    if filtered.empty:
        return pd.DataFrame(), {}, {}

    # -------------------------------------------------
    # Tahap 2: Pembobotan MCDM — User-Oriented Scoring
    # -------------------------------------------------
    # Hitung skor efisiensi gabungan berdasarkan slider city/highway
    highway_ratio = 1.0 - city_ratio
    filtered['Score_Efficiency'] = (
        (filtered['Score_City'] * city_ratio) +
        (filtered['Score_Hwy'] * highway_ratio)
    )

    # Distribusi bobot dengan FLOOR MINIMUM 10%
    # agar tidak ada dimensi yang hilang total saat slider di posisi ekstrem
    W_RANGE = 0.10
    W_PERF  = 0.10
    W_MAIN  = 0.80  # dibagi antara Eco dan Efficiency

    w_eco = max(0.10, eco_priority * W_MAIN)
    w_eff = max(0.10, (1.0 - eco_priority) * W_MAIN)

    # Re-normalize agar total bobot = 1.0
    total_w = w_eco + w_eff + W_RANGE + W_PERF
    w_eco   /= total_w
    w_eff   /= total_w
    w_range  = W_RANGE / total_w
    w_perf   = W_PERF / total_w

    filtered['Total_Score'] = (
        (filtered['Score_Eco']        * w_eco) +
        (filtered['Score_Efficiency'] * w_eff) +
        (filtered['Score_Range']      * w_range) +
        (filtered['Score_Perf']       * w_perf)
    )

    # Konversi ke persentase 0-100
    filtered['Total_Score'] = (filtered['Total_Score'] * 100).round(1)

    # Clamp ke [0, 100] untuk keamanan
    filtered['Total_Score'] = filtered['Total_Score'].clip(0, 100)

    # Ambil Top N
    result = filtered.sort_values(
        by='Total_Score', ascending=False
    ).head(top_n)

    # -------------------------------------------------
    # Tahap 3: KPI Executive Summary
    # -------------------------------------------------
    dominant_drive = (
        result['Drive_Type'].mode()[0] if not result.empty else "-"
    )

    ev_in_result = int(
        result['Vehicle_Category'].str.contains('EV', case=False, na=False).sum()
    )
    ev_percentage = (
        round((ev_in_result / len(result)) * 100, 0)
        if len(result) > 0 else 0
    )
    avg_eco_score = (
        round(result['Total_Score'].mean(), 1)
        if not result.empty else 0
    )

    kpi_data = {
        'avg_co2_kg':     round(result['Annual_CO2_Footprint_kg'].mean(), 0),
        'avg_range_miles': round(result['Unified_Range_Miles'].mean(), 0),
        'top_grade':       result.iloc[0]['Eco_Grade'] if not result.empty else "-",
        'ev_count':        ev_in_result,
        'dominant_drive':  dominant_drive,
        'avg_city_mpg':    round(result['City_MPG'].mean(), 1),
        'ev_percentage':   ev_percentage,
        'avg_eco_score':   avg_eco_score,
    }

    # -------------------------------------------------
    # Tahap 4: Chart Data (NaN-safe)
    # -------------------------------------------------
    chart_data = _build_chart_data(result, filtered)

    return result, kpi_data, chart_data


# ═══════════════════════════════════════════════════════════════
#  CHART DATA BUILDER (NaN-Safe)
# ═══════════════════════════════════════════════════════════════

def _build_chart_data(result, filtered):
    """Menyiapkan data JSON-friendly untuk chart di frontend.
    
    Semua nilai numerik dilewatkan _safe_float() untuk mencegah
    NaN/Inf yang akan membuat JSON serialization gagal.
    """

    # 1. CO2 Bar Chart — emisi per rekomendasi
    co2_bar = {
        'labels': [
            f"{r['Make']} {r['Model']}" for _, r in result.iterrows()
        ],
        'values': [
            _safe_float(r['Annual_CO2_Footprint_kg'])
            for _, r in result.iterrows()
        ],
    }

    # 2. Donut — distribusi kategori di filtered dataset
    cat_counts = filtered['Vehicle_Category'].value_counts()
    donut = {
        'labels': cat_counts.index.tolist(),
        'values': [int(v) for v in cat_counts.values.tolist()],
    }

    # 3. Scatter — MPG vs CO2 untuk top rekomendasi
    scatter = {
        'points': [
            {
                'x': _safe_float(r['Combined_MPG']),
                'y': _safe_float(r['CO2_Emissions_g_per_mile']),
                'label': f"{r['Make']} {r['Model']}",
            }
            for _, r in result.iterrows()
        ]
    }

    # 4. Radar overview — score breakdown per rekomendasi (top 3)
    top3 = result.head(3)
    radar = {
        'labels': ['Eco', 'Kota', 'Tol', 'Jarak', 'Performa'],
        'datasets': [
            {
                'name': f"{r['Make']} {r['Model']}",
                'values': [
                    _safe_float(r['Score_Eco'] * 100),
                    _safe_float(r['Score_City'] * 100),
                    _safe_float(r['Score_Hwy'] * 100),
                    _safe_float(r['Score_Range'] * 100),
                    _safe_float(r['Score_Perf'] * 100),
                ],
            }
            for _, r in top3.iterrows()
        ],
    }

    return {
        'co2_bar': co2_bar,
        'donut': donut,
        'scatter': scatter,
        'radar': radar,
    }