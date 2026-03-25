from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import numpy as np
import io
import tempfile
import os
import pyedflib

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev ก่อน
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

def downsample_signal(signal, max_points=500):
    arr = np.asarray(signal, dtype=float)
    if len(arr) <= max_points:
        return arr.tolist()
    idx = np.linspace(0, len(arr) - 1, max_points, dtype=int)
    return arr[idx].tolist()

def normalize_channels(channels_dict):
    normalized = {}
    for key, values in channels_dict.items():
        arr = np.asarray(values, dtype=float)
        if len(arr) == 0:
            normalized[key] = []
            continue
        arr = np.nan_to_num(arr)
        normalized[key] = downsample_signal(arr, max_points=500)
    return normalized

def parse_csv_bytes(content: bytes):
    df = pd.read_csv(io.BytesIO(content))

    possible_cols = {col.lower(): col for col in df.columns}

    def pick_col(name_list):
        for n in name_list:
            if n.lower() in possible_cols:
                return possible_cols[n.lower()]
        return None

    c3_col = pick_col(["C3", "c3"])
    cz_col = pick_col(["Cz", "cz", "CZ"])
    c4_col = pick_col(["C4", "c4"])

    cols = list(df.columns)
    if not c3_col and len(cols) > 0:
        c3_col = cols[0]
    if not cz_col and len(cols) > 1:
        cz_col = cols[1]
    if not c4_col and len(cols) > 2:
        c4_col = cols[2]

    def to_series(col):
        if not col:
            return []
        series = pd.to_numeric(df[col], errors="coerce").fillna(0)
        return series.tolist()

    preview = {
        "C3": to_series(c3_col),
        "Cz": to_series(cz_col),
        "C4": to_series(c4_col),
    }

    return normalize_channels(preview)

def parse_edf_bytes(content: bytes):
    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".edf") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        reader = pyedflib.EdfReader(tmp_path)
        labels = [label.strip() for label in reader.getSignalLabels()]

        def find_channel(target_names):
            for target in target_names:
                for i, label in enumerate(labels):
                    if label.lower() == target.lower():
                        return i
            for target in target_names:
                for i, label in enumerate(labels):
                    if target.lower() in label.lower():
                        return i
            return None

        c3_idx = find_channel(["C3"])
        cz_idx = find_channel(["Cz", "CZ"])
        c4_idx = find_channel(["C4"])

        # fallback: ถ้าไม่เจอจริง ๆ ใช้ 3 channel แรก
        if c3_idx is None and reader.signals_in_file > 0:
            c3_idx = 0
        if cz_idx is None and reader.signals_in_file > 1:
            cz_idx = 1
        if c4_idx is None and reader.signals_in_file > 2:
            c4_idx = 2

        def read_signal(idx):
            if idx is None:
                return []
            return reader.readSignal(idx).tolist()

        preview = {
            "C3": read_signal(c3_idx),
            "Cz": read_signal(cz_idx),
            "C4": read_signal(c4_idx),
        }

        reader.close()
        return normalize_channels(preview)

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.post("/eeg/import")
async def import_eeg(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename or "uploaded_file"
    ext = os.path.splitext(filename)[1].lower()

    try:
        if ext == ".csv":
            channels = parse_csv_bytes(content)
        elif ext == ".edf":
            channels = parse_edf_bytes(content)
        else:
            return {
                "success": False,
                "message": f"Unsupported file type: {ext}. Please upload .edf or .csv"
            }

        return {
            "success": True,
            "filename": filename,
            "channels": channels,
            "accuracy": None,
            "message": "Analysis pipeline not implemented yet"
        }

    except Exception as e:
        return {
            "success": False,
            "message": f"Failed to parse file: {str(e)}"
        }

@app.post("/board/connect")
def connect_board():
    return {
        "success": True,
        "connected": True,
        "source": "OpenBCI Cyton",
        "message": "Placeholder board connection ready"
    }

@app.post("/analysis/run")
def run_analysis():
    return {
        "success": True,
        "accuracy": None,
        "message": "Analysis code not implemented yet"
    }