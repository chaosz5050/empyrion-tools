#!/usr/bin/env python3
"""
Quick script to view the latest client logs
"""

import os
import datetime
from pathlib import Path

def view_logs():
    logs_dir = Path(__file__).parent / 'logs'
    today = datetime.date.today()
    log_file = logs_dir / f'client-{today}.log'
    
    print(f"Looking for log file: {log_file}")
    
    if log_file.exists():
        print(f"\n📋 Latest client logs from {today}:")
        print("=" * 80)
        
        with open(log_file, 'r', encoding='utf-8') as f:
            content = f.read()
            if content.strip():
                print(content)
            else:
                print("Log file exists but is empty")
    else:
        print(f"❌ No log file found for today ({today})")
        
        # Check if logs directory exists and list available files
        if logs_dir.exists():
            log_files = list(logs_dir.glob('client-*.log'))
            if log_files:
                print(f"\nAvailable log files:")
                for log_file in sorted(log_files):
                    print(f"  - {log_file.name}")
            else:
                print("No client log files found in logs directory")
        else:
            print("Logs directory doesn't exist yet")

if __name__ == "__main__":
    view_logs()