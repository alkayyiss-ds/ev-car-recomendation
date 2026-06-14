import sys
import os

# Tambahkan root project ke Python path agar bisa import recommender.py
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
