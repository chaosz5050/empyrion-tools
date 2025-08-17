#!/usr/bin/env python3
"""
Empyrion Resource Location Tracker - Web Version
A Flask-based web application for tracking resource locations in Empyrion
"""

import os
import json
import sqlite3
import csv
from datetime import datetime
from typing import List, Dict, Optional
import socket

from flask import Flask, render_template, request, jsonify, send_file, redirect, url_for
import tempfile

app = Flask(__name__)
app.secret_key = 'empyrion_resource_tracker_secret_key'

class DatabaseManager:
    """Manages SQLite database operations"""
    
    def __init__(self, db_path: str = "empyrion_resources.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database with required tables"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create resource_locations table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS resource_locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                system_name TEXT,
                sector_name TEXT NOT NULL,
                sector_type TEXT NOT NULL,
                resources TEXT NOT NULL,
                danger_level TEXT NOT NULL,
                distance_ly REAL DEFAULT 0.0,
                notes TEXT,
                added_by TEXT DEFAULT 'User',
                date_added TEXT,
                last_updated TEXT
            )
        ''')
        
        # Create app_settings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )
        ''')
        
        # Set default reference system if not exists
        cursor.execute('''
            INSERT OR IGNORE INTO app_settings (key, value) 
            VALUES ('reference_system', 'Starting Area')
        ''')
        
        conn.commit()
        conn.close()
    
    def get_all_locations(self) -> List[Dict]:
        """Get all resource locations from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT id, system_name, sector_name, sector_type, resources, 
                   danger_level, distance_ly, notes, added_by, date_added, last_updated
            FROM resource_locations
            ORDER BY sector_name
        ''')
        
        locations = []
        for row in cursor.fetchall():
            locations.append({
                'id': row[0],
                'system_name': row[1] or '',
                'sector_name': row[2],
                'sector_type': row[3],
                'resources': json.loads(row[4]) if row[4] else [],
                'danger_level': row[5],
                'distance_ly': row[6],
                'notes': row[7] or '',
                'added_by': row[8] or 'User',
                'date_added': row[9],
                'last_updated': row[10]
            })
        
        conn.close()
        return locations
    
    def save_location(self, location: Dict) -> int:
        """Save or update a location"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        now = datetime.now().isoformat()
        resources_json = json.dumps(location['resources'])
        
        if location.get('id'):
            # Update existing
            cursor.execute('''
                UPDATE resource_locations 
                SET system_name=?, sector_name=?, sector_type=?, resources=?, 
                    danger_level=?, distance_ly=?, notes=?, last_updated=?
                WHERE id=?
            ''', (
                location['system_name'], location['sector_name'], location['sector_type'],
                resources_json, location['danger_level'], location['distance_ly'],
                location['notes'], now, location['id']
            ))
            location_id = location['id']
        else:
            # Insert new
            cursor.execute('''
                INSERT INTO resource_locations 
                (system_name, sector_name, sector_type, resources, danger_level, 
                 distance_ly, notes, added_by, date_added, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                location['system_name'], location['sector_name'], location['sector_type'],
                resources_json, location['danger_level'], location['distance_ly'],
                location['notes'], location['added_by'], now, now
            ))
            location_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        return location_id
    
    def delete_location(self, location_id: int):
        """Delete a location by ID"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM resource_locations WHERE id=?', (location_id,))
        conn.commit()
        conn.close()
    
    def get_setting(self, key: str) -> str:
        """Get app setting value"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('SELECT value FROM app_settings WHERE key=?', (key,))
        result = cursor.fetchone()
        conn.close()
        return result[0] if result else ''
    
    def set_setting(self, key: str, value: str):
        """Set app setting value"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)
        ''', (key, value))
        conn.commit()
        conn.close()

# Initialize database
db = DatabaseManager()

@app.route('/')
def index():
    """Main page"""
    reference_system = db.get_setting('reference_system')
    return render_template('index.html', reference_system=reference_system)

@app.route('/api/locations')
def get_locations():
    """API endpoint to get all locations"""
    locations = db.get_all_locations()
    return jsonify(locations)

@app.route('/api/locations', methods=['POST'])
def save_location():
    """API endpoint to save a location"""
    data = request.json
    location_id = db.save_location(data)
    return jsonify({'id': location_id, 'status': 'success'})

@app.route('/api/locations/<int:location_id>', methods=['DELETE'])
def delete_location(location_id):
    """API endpoint to delete a location"""
    db.delete_location(location_id)
    return jsonify({'status': 'success'})

@app.route('/api/settings/reference_system', methods=['POST'])
def update_reference_system():
    """API endpoint to update reference system"""
    data = request.json
    db.set_setting('reference_system', data['value'])
    return jsonify({'status': 'success'})

@app.route('/export/csv')
def export_csv():
    """Export all locations to CSV"""
    locations = db.get_all_locations()
    
    # Create temporary CSV file
    temp_file = tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.csv', encoding='utf-8')
    writer = csv.writer(temp_file)
    
    # Header
    writer.writerow([
        'System Name', 'Sector Name', 'Type', 'Resources', 
        'Danger Level', 'Distance (LY)', 'Notes', 'Added By', 'Date Added'
    ])
    
    # Data
    for location in locations:
        writer.writerow([
            location['system_name'],
            location['sector_name'],
            location['sector_type'],
            ','.join(location['resources']),
            location['danger_level'],
            location['distance_ly'],
            location['notes'],
            location['added_by'],
            location.get('date_added', '')
        ])
    
    temp_file.close()
    
    return send_file(
        temp_file.name,
        as_attachment=True,
        download_name=f'empyrion_resources_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv',
        mimetype='text/csv'
    )

def get_local_ip():
    """Get local IP address for network access"""
    try:
        # Connect to a remote address to determine local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return "localhost"

# Create templates directory if it doesn't exist
if not os.path.exists('templates'):
    os.makedirs('templates')

# Write the HTML template
html_template = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Empyrion Resource Tracker</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: #1a1a1a;
            color: #ffffff;
            line-height: 1.5;
            padding: 20px;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        
        h1 {
            text-align: center;
            margin-bottom: 30px;
            color: #4a9eff;
            font-size: 2rem;
        }
        
        .controls {
            background: #2d2d2d;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            align-items: center;
        }
        
        .control-group {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        label {
            font-weight: 500;
            color: #cccccc;
            white-space: nowrap;
        }
        
        input, select, button {
            padding: 8px 12px;
            border: 1px solid #555;
            border-radius: 4px;
            background: #404040;
            color: #ffffff;
            font-size: 14px;
        }
        
        input:focus, select:focus {
            outline: none;
            border-color: #4a9eff;
            box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.2);
        }
        
        button {
            background: #4a9eff;
            border: none;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        button:hover {
            background: #357abd;
        }
        
        button.danger {
            background: #ff4444;
        }
        
        button.danger:hover {
            background: #cc3333;
        }
        
        .table-container {
            background: #2d2d2d;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
        }
        
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #444;
        }
        
        th {
            background: #404040;
            font-weight: 600;
            color: #4a9eff;
            position: sticky;
            top: 0;
            z-index: 10;
        }
        
        tr:hover {
            background: rgba(74, 158, 255, 0.1);
        }
        
        .resource-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        
        .resource-tag {
            background: #4a9eff;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .resource-tag .remove {
            cursor: pointer;
            font-weight: bold;
            opacity: 0.7;
        }
        
        .resource-tag .remove:hover {
            opacity: 1;
            color: #ff4444;
        }
        
        .add-resource {
            background: #555;
            color: #ccc;
            border: 1px dashed #777;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            cursor: pointer;
        }
        
        .add-resource:hover {
            background: #666;
            color: #fff;
        }
        
        .danger-low { color: #4CAF50; }
        .danger-medium { color: #FF9800; }
        .danger-high { color: #F44336; }
        
        .editable {
            background: transparent;
            border: 1px solid transparent;
            color: inherit;
            width: 100%;
        }
        
        .editable:focus {
            background: #404040;
            border-color: #4a9eff;
        }
        
        select.editable {
            background: #404040;
        }
        
        .actions {
            display: flex;
            gap: 5px;
        }
        
        .btn-small {
            padding: 4px 8px;
            font-size: 12px;
        }
        
        .status {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #4a9eff;
            color: white;
            padding: 10px 20px;
            border-radius: 4px;
            display: none;
            z-index: 1000;
        }
        
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .controls {
                flex-direction: column;
                align-items: stretch;
            }
            
            .control-group {
                justify-content: space-between;
            }
            
            h1 {
                font-size: 1.5rem;
            }
            
            .table-container {
                overflow-x: auto;
            }
            
            table {
                min-width: 800px;
            }
            
            th, td {
                padding: 8px;
                font-size: 14px;
            }
        }
        
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 2000;
        }
        
        .modal-content {
            background: #2d2d2d;
            margin: 10% auto;
            padding: 20px;
            border-radius: 8px;
            max-width: 400px;
            position: relative;
        }
        
        .modal-close {
            position: absolute;
            top: 10px;
            right: 15px;
            font-size: 24px;
            cursor: pointer;
            color: #ccc;
        }
        
        .modal-close:hover {
            color: #fff;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Empyrion Resource Tracker</h1>
        
        <div class="controls">
            <button onclick="addNewLocation()">+ Add Location</button>
            <button onclick="exportCSV()">📥 Export CSV</button>
            
            <div class="control-group">
                <label>Filter Name:</label>
                <input type="text" id="filterName" placeholder="System or sector..." onkeyup="applyFilters()">
            </div>
            
            <div class="control-group">
                <label>Type:</label>
                <select id="filterType" onchange="applyFilters()">
                    <option value="">All</option>
                    <option value="Sector">Sector</option>
                    <option value="Planet">Planet</option>
                    <option value="Moon">Moon</option>
                </select>
            </div>
            
            <div class="control-group">
                <label>Danger:</label>
                <select id="filterDanger" onchange="applyFilters()">
                    <option value="">All</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                </select>
            </div>
            
            <div class="control-group">
                <label>Resource:</label>
                <input type="text" id="filterResource" placeholder="Iron, Copper..." onkeyup="applyFilters()">
            </div>
            
            <div class="control-group">
                <label>Distance from:</label>
                <input type="text" id="referenceSystem" value="{{ reference_system }}" onchange="updateReferenceSystem()">
            </div>
        </div>
        
        <div class="table-container">
            <table id="locationsTable">
                <thead>
                    <tr>
                        <th>System</th>
                        <th>Sector Name</th>
                        <th>Type</th>
                        <th>Resources</th>
                        <th>Danger</th>
                        <th>Distance (LY)</th>
                        <th>Notes</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                </tbody>
            </table>
        </div>
    </div>
    
    <div class="status" id="status"></div>
    
    <!-- Modal for adding resources -->
    <div class="modal" id="resourceModal">
        <div class="modal-content">
            <span class="modal-close" onclick="closeResourceModal()">&times;</span>
            <h3>Add Resource</h3>
            <input type="text" id="newResourceName" placeholder="Enter resource name..." style="width: 100%; margin: 15px 0;">
            <button onclick="confirmAddResource()">Add</button>
            <button onclick="closeResourceModal()" style="margin-left: 10px; background: #666;">Cancel</button>
        </div>
    </div>
    
    <script>
        let locations = [];
        let filteredLocations = [];
        let currentEditingResource = null;
        
        // Load data on page load
        window.onload = function() {
            loadLocations();
        };
        
        async function loadLocations() {
            try {
                const response = await fetch('/api/locations');
                locations = await response.json();
                applyFilters();
                showStatus('Locations loaded successfully');
            } catch (error) {
                showStatus('Error loading locations: ' + error.message, true);
            }
        }
        
        function applyFilters() {
            const nameFilter = document.getElementById('filterName').value.toLowerCase();
            const typeFilter = document.getElementById('filterType').value;
            const dangerFilter = document.getElementById('filterDanger').value;
            const resourceFilter = document.getElementById('filterResource').value.toLowerCase();
            
            filteredLocations = locations.filter(location => {
                // Name filter
                if (nameFilter) {
                    const fullName = `${location.system_name} ${location.sector_name}`.toLowerCase();
                    if (!fullName.includes(nameFilter)) return false;
                }
                
                // Type filter
                if (typeFilter && location.sector_type !== typeFilter) return false;
                
                // Danger filter
                if (dangerFilter && location.danger_level !== dangerFilter) return false;
                
                // Resource filter
                if (resourceFilter) {
                    const resources = location.resources.join(' ').toLowerCase();
                    if (!resources.includes(resourceFilter)) return false;
                }
                
                return true;
            });
            
            renderTable();
        }
        
        function renderTable() {
            const tbody = document.querySelector('#locationsTable tbody');
            tbody.innerHTML = '';
            
            filteredLocations.forEach((location, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td><input type="text" class="editable" value="${location.system_name}" onchange="updateLocation(${location.id}, 'system_name', this.value)"></td>
                    <td><input type="text" class="editable" value="${location.sector_name}" onchange="updateLocation(${location.id}, 'sector_name', this.value)"></td>
                    <td>
                        <select class="editable" onchange="updateLocation(${location.id}, 'sector_type', this.value)">
                            <option value="Sector" ${location.sector_type === 'Sector' ? 'selected' : ''}>Sector</option>
                            <option value="Planet" ${location.sector_type === 'Planet' ? 'selected' : ''}>Planet</option>
                            <option value="Moon" ${location.sector_type === 'Moon' ? 'selected' : ''}>Moon</option>
                        </select>
                    </td>
                    <td>
                        <div class="resource-tags" data-location-id="${location.id}">
                            ${location.resources.map(resource => `
                                <span class="resource-tag">
                                    ${resource}
                                    <span class="remove" onclick="removeResource(${location.id}, '${resource}')">&times;</span>
                                </span>
                            `).join('')}
                            <span class="add-resource" onclick="showAddResource(${location.id})">+ Add</span>
                        </div>
                    </td>
                    <td>
                        <select class="editable" onchange="updateLocation(${location.id}, 'danger_level', this.value)">
                            <option value="Low" ${location.danger_level === 'Low' ? 'selected' : ''}>Low</option>
                            <option value="Medium" ${location.danger_level === 'Medium' ? 'selected' : ''}>Medium</option>
                            <option value="High" ${location.danger_level === 'High' ? 'selected' : ''}>High</option>
                        </select>
                    </td>
                    <td><input type="number" class="editable" step="0.1" value="${location.distance_ly}" onchange="updateLocation(${location.id}, 'distance_ly', parseFloat(this.value) || 0)"></td>
                    <td><input type="text" class="editable" value="${location.notes}" onchange="updateLocation(${location.id}, 'notes', this.value)"></td>
                    <td>
                        <div class="actions">
                            <button class="btn-small danger" onclick="deleteLocation(${location.id})">Delete</button>
                        </div>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }
        
        async function updateLocation(id, field, value) {
            const location = locations.find(l => l.id === id);
            if (!location) return;
            
            location[field] = value;
            
            try {
                await fetch('/api/locations', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(location)
                });
                showStatus(`Updated ${location.sector_name}`);
            } catch (error) {
                showStatus('Error updating location: ' + error.message, true);
            }
        }
        
        async function addNewLocation() {
            const newLocation = {
                system_name: '',
                sector_name: 'New Sector',
                sector_type: 'Sector',
                resources: [],
                danger_level: 'Low',
                distance_ly: 0.0,
                notes: '',
                added_by: 'User'
            };
            
            try {
                const response = await fetch('/api/locations', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(newLocation)
                });
                const result = await response.json();
                newLocation.id = result.id;
                locations.push(newLocation);
                applyFilters();
                showStatus('New location added');
            } catch (error) {
                showStatus('Error adding location: ' + error.message, true);
            }
        }
        
        async function deleteLocation(id) {
            if (!confirm('Are you sure you want to delete this location?')) return;
            
            try {
                await fetch(`/api/locations/${id}`, {method: 'DELETE'});
                locations = locations.filter(l => l.id !== id);
                applyFilters();
                showStatus('Location deleted');
            } catch (error) {
                showStatus('Error deleting location: ' + error.message, true);
            }
        }
        
        function showAddResource(locationId) {
            currentEditingResource = locationId;
            document.getElementById('resourceModal').style.display = 'block';
            document.getElementById('newResourceName').focus();
        }
        
        function closeResourceModal() {
            document.getElementById('resourceModal').style.display = 'none';
            document.getElementById('newResourceName').value = '';
            currentEditingResource = null;
        }
        
        async function confirmAddResource() {
            const resourceName = document.getElementById('newResourceName').value.trim();
            if (!resourceName || !currentEditingResource) return;
            
            const location = locations.find(l => l.id === currentEditingResource);
            if (!location || location.resources.includes(resourceName)) {
                closeResourceModal();
                return;
            }
            
            location.resources.push(resourceName);
            await updateLocation(location.id, 'resources', location.resources);
            applyFilters();
            closeResourceModal();
        }
        
        async function removeResource(locationId, resource) {
            const location = locations.find(l => l.id === locationId);
            if (!location) return;
            
            location.resources = location.resources.filter(r => r !== resource);
            await updateLocation(locationId, 'resources', location.resources);
            applyFilters();
        }
        
        async function updateReferenceSystem() {
            const value = document.getElementById('referenceSystem').value;
            try {
                await fetch('/api/settings/reference_system', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({value})
                });
                showStatus('Reference system updated');
            } catch (error) {
                showStatus('Error updating reference system: ' + error.message, true);
            }
        }
        
        function exportCSV() {
            window.open('/export/csv', '_blank');
        }
        
        function showStatus(message, isError = false) {
            const status = document.getElementById('status');
            status.textContent = message;
            status.style.display = 'block';
            status.style.background = isError ? '#ff4444' : '#4a9eff';
            
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
        
        // Handle Enter key in resource modal
        document.getElementById('newResourceName').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                confirmAddResource();
            }
        });
        
        // Handle Escape key to close modal
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeResourceModal();
            }
        });
    </script>
</body>
</html>'''

# Write the template file
with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(html_template)

if __name__ == '__main__':
    local_ip = get_local_ip()
    port = 5000
    
    print("🚀 Empyrion Resource Location Tracker")
    print("=" * 50)
    print(f"🖥️  Local access:   http://localhost:{port}")
    print(f"📱 Network access:  http://{local_ip}:{port}")
    print("=" * 50)
    print("📝 Instructions:")
    print("• Access from your CachyOS machine: localhost:5000")
    print("• Access from phone/other devices: use the network IP")
    print("• Press Ctrl+C to stop the server")
    print("=" * 50)
    
    app.run(host='0.0.0.0', port=port, debug=False)
