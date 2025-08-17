# Empyrion Tools Collection

[![Platform](https://img.shields.io/badge/Platform-Linux-blue?style=for-the-badge&logo=linux)](https://www.linux.org/)
[![Python](https://img.shields.io/badge/Python-3.8%2B-green?style=for-the-badge&logo=python)](https://www.python.org/)
[![Tools](https://img.shields.io/badge/Tools-3%20Available-orange?style=for-the-badge)](https://github.com/chaosz5050/empyrion-tools)
[![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-red?style=for-the-badge)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

A collection of Python-based server management and utility tools for Empyrion Galactic Survival servers.

## 🛠️ Available Tools

### empyrion-web-helper
**Comprehensive web-based server management interface**
- Real-time player monitoring and management
- Server messaging and announcements system  
- Player purge functionality with safety checks
- FTP and RCON connection management
- Entity management and cleanup tools
- Multi-theme UI (Dark, Light, Blue, Retro)

**Features:**
- Background service for automatic updates
- Bulletproof player management with backups
- Help commands configuration
- Connection status monitoring
- Comprehensive logging system

### EmpyrionResourceNotebook
**Resource tracking and analysis tool**
- Track server resource usage and trends
- Player activity monitoring
- Resource consumption analysis
- Database-driven insights

### EmpyrionScenarioEditor  
**Scenario editing and management utility**
- Edit Empyrion scenario files
- Bulk modifications and updates
- Scenario validation tools
- Configuration management

## 🚀 Quick Start

### empyrion-web-helper
```bash
cd empyrion-web-helper/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### EmpyrionResourceNotebook
```bash
cd EmpyrionResourceNotebook/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python empyrion_resource_tracker.py
```

### EmpyrionScenarioEditor
```bash
cd EmpyrionScenarioEditor/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

## 📋 Requirements

- Python 3.8+
- Virtual environment (recommended)
- See individual tool `requirements.txt` files for specific dependencies

## 🔧 Configuration

Each tool has its own configuration system:
- **empyrion-web-helper**: `empyrion_helper.conf`
- **EmpyrionResourceNotebook**: Embedded configuration
- **EmpyrionScenarioEditor**: Configuration via web interface

## 📚 Documentation

Detailed documentation for each tool can be found in their respective directories:
- `empyrion-web-helper/README.md`
- `EmpyrionResourceNotebook/README.md`  
- `EmpyrionScenarioEditor/README.md`

## 🤝 Contributing

Each tool maintains its own development workflow. See individual tool directories for contribution guidelines.

## 📄 License

Each tool may have its own license. Check individual tool directories for licensing information.

---

🤖 *Generated with [Claude Code](https://claude.ai/code)*