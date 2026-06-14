import json
from flask import Flask, render_template, request
from recommender import load_and_prep_data, get_recommendations, get_dataset_stats

app = Flask(__name__)

# Load data di memory saat server Flask dijalankan pertama kali
# Pastikan jalur file CSV benar!
df = load_and_prep_data("data/EV_vs_ICE_Vehicle_Specs_2015_2026.csv")
dataset_stats = get_dataset_stats(df)

@app.route('/', methods=['GET', 'POST'])
def index():
    recommendations = None
    kpi = None
    chart_data = None
    
    if request.method == 'POST':
        # Mengambil input dari form HTML
        min_year = int(request.form.get('min_year', 2015))
        fuel_pref = request.form.get('fuel_pref', 'All')
        
        # Konversi persentase ke decimal (0.0 - 1.0)
        city_ratio = int(request.form.get('city_ratio', 50)) / 100.0
        eco_priority = int(request.form.get('eco_priority', 50)) / 100.0
        
        # Panggil fungsi Machine Learning (Menerima 3 output: Data Mobil, KPI, Chart Data)
        recs_df, kpi_data, chart_json = get_recommendations(df, min_year, fuel_pref, city_ratio, eco_priority)
        
        if not recs_df.empty:
            recommendations = recs_df.to_dict(orient='records')
            kpi = kpi_data
            chart_data = chart_json
        else:
            recommendations = []
            
    return render_template(
        'index.html',
        recommendations=recommendations,
        kpi=kpi,
        chart_data_json=json.dumps(chart_data) if chart_data else 'null',
        stats=dataset_stats,
    )

if __name__ == '__main__':
    # Jalankan server lokal di mode debug
    app.run(debug=True)