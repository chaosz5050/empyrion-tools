/**
 * Galaxy Viewer - 3D visualization of Empyrion solar systems
 * Uses Three.js to render star systems, connections, and allow navigation
 */

class GalaxyViewer {
    constructor(containerId) {
        console.log(`GalaxyViewer constructor called with containerId: ${containerId}`);
        
        this.container = document.getElementById(containerId);
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.systemObjects = [];
        this.connectionLines = [];
        this.distanceLabels = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.hoveredObject = null;
        this.initialized = false;
        
        // Distance calculation settings
        this.showDistances = true;
        this.maxConnectionDistance = 500; // Light Years - show most connections
        this.minConnectionDistance = 0.1; // Show almost all distances
        this.showAllDistances = true;     // Show distances between all systems
        
        this.updateLoadingStatus('Checking Three.js availability...');
        this.init();
    }
    
    init() {
        try {
            if (!this.container) {
                this.showError('Galaxy viewer container not found');
                return;
            }
            
            // Check if Three.js is loaded
            if (typeof THREE === 'undefined') {
                this.showError('Three.js library not loaded. Please check your internet connection.');
                return;
            }
            
            this.updateLoadingStatus('Initializing 3D scene...', 20);
            
            // Scene setup
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x0a0a0a); // Dark space background
            
            this.updateLoadingStatus('Setting up camera...', 40);
            
            // Camera setup
            const width = this.container.clientWidth || 800;
            const height = this.container.clientHeight || 600;
            const aspect = width / height;
            this.camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 10000);
            this.camera.position.set(0, 100, 200);
            
            this.updateLoadingStatus('Creating WebGL renderer...', 60);
            
            // Renderer setup
            this.renderer = new THREE.WebGLRenderer({ antialias: true });
            
            console.log(`Setting renderer size to ${width}x${height} (container: ${this.container.clientWidth}x${this.container.clientHeight})`);
            
            this.renderer.setSize(width, height);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            this.updateLoadingStatus('Setting up controls...', 80);
            
            // Check if OrbitControls is available
            if (typeof THREE.OrbitControls === 'undefined') {
                this.showError('OrbitControls not loaded. Please check your internet connection.');
                return;
            }
            
            // Controls (orbit controls for navigation)
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.05;
            this.controls.maxDistance = 1000;
            this.controls.minDistance = 10;
            
            // Lighting
            this.setupLighting();
            
            // Event listeners
            this.setupEventListeners();
            
            this.updateLoadingStatus('Finalizing...', 90);
            
            // Add renderer to container (don't replace content)
            this.renderer.domElement.style.display = 'block';
            this.renderer.domElement.style.width = '100%';
            this.renderer.domElement.style.height = '100%';
            this.container.appendChild(this.renderer.domElement);
            
            // Start animation loop
            this.animate();
            
            // Force a resize to ensure proper canvas dimensions
            setTimeout(() => {
                this.onWindowResize();
            }, 100);
            
            this.updateLoadingStatus('Galaxy viewer ready!', 100);
            setTimeout(() => this.hideLoading(), 500);
            
            this.initialized = true;
            console.log('🌌 Galaxy Viewer initialized successfully');
            
        } catch (error) {
            console.error('Galaxy Viewer initialization failed:', error);
            this.showError(`Failed to initialize 3D viewer: ${error.message}`);
        }
    }
    
    setupLighting() {
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        // Directional light for star highlighting
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Point light at origin for central glow
        const centerLight = new THREE.PointLight(0x66ccff, 1.0, 500);
        centerLight.position.set(0, 0, 0);
        this.scene.add(centerLight);
    }
    
    setupEventListeners() {
        // Mouse movement for hover effects
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.onMouseMove(event);
        });
        
        // Click for selection
        this.renderer.domElement.addEventListener('click', (event) => {
            this.onMouseClick(event);
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.onWindowResize();
        });
    }
    
    onMouseMove(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Raycast for hover detection
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.systemObjects);
        
        // Reset previous hover
        if (this.hoveredObject) {
            this.hoveredObject.material.emissive.setHex(0x000000);
            this.hoveredObject = null;
            this.hideSystemInfo();
        }
        
        // Handle new hover
        if (intersects.length > 0) {
            this.hoveredObject = intersects[0].object;
            this.hoveredObject.material.emissive.setHex(0x444444);
            this.showSystemInfo(this.hoveredObject.userData, event);
        }
    }
    
    onMouseClick(event) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.systemObjects);
        
        if (intersects.length > 0) {
            const systemData = intersects[0].object.userData;
            this.selectSystem(systemData);
        }
    }
    
    onWindowResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    loadGalaxyData(solarSystemConfig) {
        // Clear existing objects
        this.clearGalaxy();
        
        if (!solarSystemConfig || !solarSystemConfig.SolarSystems) {
            return;
        }
        
        const systems = solarSystemConfig.SolarSystems;
        const totalSystems = systems.length;
        
        this.updateLoadingStatus(`Creating ${totalSystems} star systems...`, 0);
        
        // Create star systems with progress tracking
        systems.forEach((system, index) => {
            // Calculate progress
            const progress = Math.round(((index + 1) / totalSystems) * 80); // Reserve 20% for final steps
            
            this.createStarSystem(system, index);
            this.updateLoadingStatus(`Creating star systems... (${index + 1}/${totalSystems})`, progress);
        });
        
        this.updateLoadingStatus('Creating connections...', 85);
        // Create connections between systems
        this.createSystemConnections(solarSystemConfig);
        
        this.updateLoadingStatus('Positioning camera...', 95);
        // Center camera on galaxy
        this.centerCamera();
        
        this.updateLoadingStatus('Galaxy ready!', 100);
        console.log(`✨ Created ${this.systemObjects.length} star systems`);
        
        // Hide loading after a brief moment
        setTimeout(() => this.hideLoading(), 500);
    }
    
    createStarSystem(systemData, index) {
        // Extract position (use provided coordinates or generate based on index)
        const position = this.getSystemPosition(systemData, index);
        
        // Determine system type and color
        const systemType = this.getSystemType(systemData);
        const color = this.getSystemColor(systemType);
        const size = this.getSystemSize(systemType);
        
        // Create system geometry and material
        const geometry = new THREE.SphereGeometry(size, 16, 16);
        const material = new THREE.MeshLambertMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.8
        });
        
        const systemMesh = new THREE.Mesh(geometry, material);
        systemMesh.position.set(position.x, position.y, position.z);
        
        // Store system data
        systemMesh.userData = {
            name: systemData.Name || `System ${index + 1}`,
            type: systemType,
            playfields: systemData.Playfields || [],
            coordinates: position,
            originalData: systemData
        };
        
        // Add glow effect
        this.addSystemGlow(systemMesh, color);
        
        // Add text label
        this.addSystemLabel(systemMesh, systemData.Name || `System ${index + 1}`, position);
        
        this.scene.add(systemMesh);
        this.systemObjects.push(systemMesh);
        
        console.log(`Created system "${systemMesh.userData.name}" at (${position.x.toFixed(1)}, ${position.y.toFixed(1)}, ${position.z.toFixed(1)}) with size ${size} and color #${color.toString(16)}`);
    }
    
    getSystemPosition(systemData, index) {
        // Check for explicit coordinates
        if (systemData.Coordinates) {
            return {
                x: systemData.Coordinates.x || 0,
                y: systemData.Coordinates.y || 0,
                z: systemData.Coordinates.z || 0
            };
        }
        
        // Generate spiral galaxy layout if no coordinates
        const angle = (index / this.systemObjects.length) * Math.PI * 4; // Spiral arms
        const radius = 50 + (index * 10); // Expanding spiral
        const height = (Math.random() - 0.5) * 20; // Some vertical variance
        
        return {
            x: Math.cos(angle) * radius,
            y: height,
            z: Math.sin(angle) * radius
        };
    }
    
    getSystemType(systemData) {
        // Analyze playfields to determine system type
        if (!systemData.Playfields || systemData.Playfields.length === 0) {
            return 'empty';
        }
        
        const playfields = systemData.Playfields;
        
        // Check for specific playfield types
        if (playfields.some(p => p.includes('Sun') || p.includes('Star'))) {
            return 'star';
        }
        if (playfields.some(p => p.includes('Station') || p.includes('Trading'))) {
            return 'station';
        }
        if (playfields.some(p => p.includes('Asteroid') || p.includes('Mining'))) {
            return 'asteroid';
        }
        if (playfields.some(p => p.includes('Planet') || p.includes('Moon'))) {
            return 'planetary';
        }
        
        return 'unknown';
    }
    
    getSystemColor(systemType) {
        const colors = {
            'star': 0xffff66,      // Yellow for stars
            'planetary': 0x66ff66,  // Green for planets
            'station': 0x66ccff,    // Blue for stations
            'asteroid': 0xcc6600,   // Orange for asteroids
            'empty': 0x666666,     // Gray for empty systems
            'unknown': 0xff66ff     // Purple for unknown
        };
        
        return colors[systemType] || colors.unknown;
    }
    
    getSystemSize(systemType) {
        const sizes = {
            'star': 8,
            'planetary': 6,
            'station': 4,
            'asteroid': 3,
            'empty': 2,
            'unknown': 3
        };
        
        return sizes[systemType] || 3;
    }
    
    addSystemGlow(systemMesh, color) {
        // Create a larger, transparent sphere for glow effect
        const glowGeometry = new THREE.SphereGeometry(systemMesh.geometry.parameters.radius * 1.5, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.2,
            side: THREE.BackSide
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        systemMesh.add(glowMesh);
    }
    
    addSystemLabel(systemMesh, text, position) {
        // Create canvas for text
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Style the text
        context.fillStyle = 'rgba(0, 0, 0, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = '#ffffff';
        context.font = 'bold 16px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        // Create texture and material
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        
        // Position label above the system
        const labelOffset = systemMesh.geometry.parameters.radius + 15;
        sprite.position.set(position.x, position.y + labelOffset, position.z);
        sprite.scale.set(30, 7.5, 1);
        
        // Add to scene
        this.scene.add(sprite);
        this.systemObjects.push(sprite); // Include in system objects for cleanup
    }
    
    createSystemConnections(solarSystemConfig) {
        console.log('🔗 Creating system connections and distance labels...');
        
        if (this.systemObjects.length < 2) {
            console.log('Not enough systems for connections');
            return;
        }
        
        // Calculate distances between all systems and create connections
        const systems = this.systemObjects.filter(obj => obj.userData && obj.userData.coordinates);
        
        for (let i = 0; i < systems.length; i++) {
            for (let j = i + 1; j < systems.length; j++) {
                const system1 = systems[i];
                const system2 = systems[j];
                
                const distance = this.calculateDistance(
                    system1.userData.coordinates,
                    system2.userData.coordinates
                );
                
                // Show connections based on settings
                const shouldShowConnection = this.showAllDistances || 
                    (distance >= this.minConnectionDistance && distance <= this.maxConnectionDistance);
                
                if (shouldShowConnection) {
                    this.createConnectionLine(system1, system2, distance);
                    
                    // Only show distance labels for closer systems to avoid clutter
                    if (this.showDistances && distance <= 150) {
                        this.createDistanceLabel(system1, system2, distance);
                    }
                }
            }
        }
        
        console.log(`Created ${this.connectionLines.length} connections and ${this.distanceLabels.length} distance labels`);
    }
    
    /**
     * Calculate 3D distance between two coordinate points in Light Years
     */
    calculateDistance(coord1, coord2) {
        const dx = coord1.x - coord2.x;
        const dy = coord1.y - coord2.y;
        const dz = coord1.z - coord2.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    
    /**
     * Create visual connection line between two systems
     */
    createConnectionLine(system1, system2, distance) {
        const points = [
            new THREE.Vector3(
                system1.userData.coordinates.x,
                system1.userData.coordinates.y,
                system1.userData.coordinates.z
            ),
            new THREE.Vector3(
                system2.userData.coordinates.x,
                system2.userData.coordinates.y,
                system2.userData.coordinates.z
            )
        ];
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Line color and opacity based on distance (closer = brighter, more opaque)
        const normalizedDistance = Math.min(distance / 100, 1.0); // Use 100 LY as reference
        const intensity = 1.0 - normalizedDistance;
        const color = new THREE.Color().setHSL(0.6, 0.8, 0.2 + intensity * 0.5);
        
        // Make very long lines more transparent to reduce clutter
        let opacity = 0.6;
        if (distance > 100) {
            opacity = Math.max(0.2, 0.6 - (distance - 100) / 200); // Fade out for very long distances
        }
        
        const material = new THREE.LineBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: opacity
        });
        
        const line = new THREE.Line(geometry, material);
        line.userData = {
            system1: system1.userData,
            system2: system2.userData,
            distance: distance
        };
        
        this.scene.add(line);
        this.connectionLines.push(line);
    }
    
    /**
     * Create distance label between two systems
     */
    createDistanceLabel(system1, system2, distance) {
        // Calculate midpoint between systems
        const midpoint = new THREE.Vector3(
            (system1.userData.coordinates.x + system2.userData.coordinates.x) / 2,
            (system1.userData.coordinates.y + system2.userData.coordinates.y) / 2,
            (system1.userData.coordinates.z + system2.userData.coordinates.z) / 2
        );
        
        // Create distance text
        const distanceText = `${distance.toFixed(1)} LY`;
        
        // Create canvas for distance label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 128;
        canvas.height = 32;
        
        // Style the distance label
        context.fillStyle = 'rgba(0, 0, 0, 0.7)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        context.fillStyle = '#ffffff';
        context.font = 'bold 12px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(distanceText, canvas.width / 2, canvas.height / 2);
        
        // Create texture and material
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.8
        });
        const sprite = new THREE.Sprite(material);
        
        // Position at midpoint with slight offset
        sprite.position.copy(midpoint);
        sprite.position.y += 5; // Slight vertical offset
        sprite.scale.set(15, 3.75, 1);
        
        // Store connection info
        sprite.userData = {
            system1: system1.userData,
            system2: system2.userData,
            distance: distance,
            isDistanceLabel: true
        };
        
        this.scene.add(sprite);
        this.distanceLabels.push(sprite);
    }
    
    centerCamera() {
        if (this.systemObjects.length === 0) {
            console.warn('No systems to center camera on');
            return;
        }
        
        // Calculate bounding box of all systems
        const box = new THREE.Box3();
        this.systemObjects.forEach(obj => {
            box.expandByObject(obj);
        });
        
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        console.log(`Galaxy bounds: center(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}) size(${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)})`);
        
        // Position camera to see all systems
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = Math.max(maxDim * 1.5, 200); // Ensure minimum distance
        
        this.camera.position.set(center.x + distance * 0.7, center.y + distance * 0.5, center.z + distance * 0.7);
        this.camera.lookAt(center);
        this.controls.target.copy(center);
        
        console.log(`Camera positioned at (${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)}) looking at (${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)})`);
    }
    
    clearGalaxy() {
        // Remove all system objects
        this.systemObjects.forEach(obj => {
            this.scene.remove(obj);
        });
        this.systemObjects = [];
        
        // Remove connection lines
        this.connectionLines.forEach(line => {
            this.scene.remove(line);
        });
        this.connectionLines = [];
        
        // Remove distance labels
        this.distanceLabels.forEach(label => {
            this.scene.remove(label);
        });
        this.distanceLabels = [];
    }
    
    showSystemInfo(systemData, event) {
        // Create floating info panel
        const infoPanel = document.getElementById('galaxy-system-info');
        if (infoPanel) {
            infoPanel.style.display = 'block';
            infoPanel.style.left = event.clientX + 10 + 'px';
            infoPanel.style.top = event.clientY - 50 + 'px';
            
            // Calculate distances to nearby systems
            const nearbyDistances = this.getNearbySystemDistances(systemData);
            const distancesHtml = nearbyDistances.length > 0 
                ? `<p><strong>Nearby Systems:</strong><br>${nearbyDistances.map(d => `${d.name}: ${d.distance.toFixed(1)} LY`).join('<br>')}</p>`
                : '';
            
            infoPanel.innerHTML = `
                <div class="system-info-content">
                    <h4>${systemData.name}</h4>
                    <p><strong>Type:</strong> ${systemData.type}</p>
                    <p><strong>Playfields:</strong> ${systemData.playfields.length}</p>
                    <p><strong>Position:</strong> ${Math.round(systemData.coordinates.x)}, ${Math.round(systemData.coordinates.y)}, ${Math.round(systemData.coordinates.z)}</p>
                    ${distancesHtml}
                </div>
            `;
        }
    }
    
    /**
     * Get distances to nearby systems for hover tooltips
     */
    getNearbySystemDistances(currentSystemData) {
        const systems = this.systemObjects.filter(obj => 
            obj.userData && 
            obj.userData.coordinates && 
            obj.userData.name !== currentSystemData.name
        );
        
        const distances = systems.map(system => ({
            name: system.userData.name,
            distance: this.calculateDistance(
                currentSystemData.coordinates,
                system.userData.coordinates
            )
        }));
        
        // Return only the 3 closest systems within display range
        return distances
            .filter(d => d.distance <= this.maxConnectionDistance)
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3);
    }
    
    hideSystemInfo() {
        const infoPanel = document.getElementById('galaxy-system-info');
        if (infoPanel) {
            infoPanel.style.display = 'none';
        }
    }
    
    selectSystem(systemData) {
        console.log('🎯 Selected system:', systemData.name);
        
        // Emit event for system selection
        const event = new CustomEvent('systemSelected', { detail: systemData });
        document.dispatchEvent(event);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        if (this.controls) {
            this.controls.update();
        }
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    updateLoadingStatus(message, progress = null) {
        const loadingElement = document.getElementById('galaxy-loading');
        if (loadingElement) {
            let html = `🌌 ${message}`;
            if (progress !== null) {
                html += `<br><div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <small>${progress}%</small>`;
            }
            loadingElement.innerHTML = html;
        }
        console.log(`Galaxy Viewer: ${message}`);
    }
    
    showError(message) {
        const loadingElement = this.container.querySelector('.galaxy-loading');
        if (loadingElement) {
            loadingElement.innerHTML = `
                <div class="galaxy-error">
                    ❌ ${message}
                    <br><small>Check browser console for more details</small>
                    <br><button onclick="location.reload()" class="btn btn-secondary" style="margin-top: 12px;">Reload Page</button>
                </div>
            `;
        }
        console.error(`Galaxy Viewer Error: ${message}`);
    }
    
    hideLoading() {
        const loadingElement = document.getElementById('galaxy-loading');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }
}

// Global galaxy viewer instance
let galaxyViewer = null;

// Initialize galaxy viewer when tab is shown
function initGalaxyViewer() {
    if (!galaxyViewer) {
        console.log('Starting Galaxy Viewer initialization');
        
        // Check if container exists
        const container = document.getElementById('galaxy-viewer-container');
        if (!container) {
            console.error('Galaxy viewer container not found');
            return;
        }
        
        // Check if Three.js is available
        if (typeof THREE === 'undefined') {
            console.error('Three.js not loaded from CDN');
            container.innerHTML = `
                <div class="galaxy-error">
                    ❌ Three.js library failed to load
                    <br><small>Please check your internet connection and try refreshing the page</small>
                    <br><button onclick="location.reload()" class="btn btn-secondary" style="margin-top: 12px;">Reload Page</button>
                </div>
            `;
            return;
        }
        
        // Check if OrbitControls is available
        if (typeof THREE.OrbitControls === 'undefined') {
            console.error('OrbitControls not loaded from CDN');
            container.innerHTML = `
                <div class="galaxy-error">
                    ❌ Three.js OrbitControls failed to load
                    <br><small>Please check your internet connection and try refreshing the page</small>
                    <br><button onclick="location.reload()" class="btn btn-secondary" style="margin-top: 12px;">Reload Page</button>
                </div>
            `;
            return;
        }
        
        console.log('All dependencies available, creating GalaxyViewer instance');
        
        try {
            galaxyViewer = new GalaxyViewer('galaxy-viewer-container');
            console.log('GalaxyViewer instance created successfully');
        } catch (error) {
            console.error('Failed to create Galaxy Viewer', error);
            container.innerHTML = `
                <div class="galaxy-error">
                    ❌ Failed to initialize 3D viewer
                    <br><small>${error.message}</small>
                    <br><button onclick="location.reload()" class="btn btn-secondary" style="margin-top: 12px;">Reload Page</button>
                </div>
            `;
        }
    } else {
        console.log('Galaxy viewer already initialized');
    }
}

// Load galaxy data into viewer
function loadGalaxyData(scenarioData) {
    if (!galaxyViewer) {
        initGalaxyViewer();
    }
    
    // Extract solar system config from scenario data
    const solarSystemConfig = extractSolarSystemConfig(scenarioData);
    galaxyViewer.loadGalaxyData(solarSystemConfig);
}

// Extract solar system configuration from scenario data
function extractSolarSystemConfig(scenarioData) {
    // Check for Random Solar System Config (generation parameters)
    if (scenarioData.files && scenarioData.files['Random Solar System Config']) {
        const config = scenarioData.files['Random Solar System Config'].content;
        // Convert generation parameters to displayable solar systems
        return convertGenerationParamsToSolarSystems(config);
    }
    
    // Check for direct Solar System Config 
    if (scenarioData.files && scenarioData.files['Solar System Config']) {
        return scenarioData.files['Solar System Config'].content;
    }
    
    // Generate sample data if no config found
    return generateSampleGalaxyData(scenarioData);
}

// Generate sample galaxy data for scenarios without explicit configs
function generateSampleGalaxyData(scenarioData) {
    const structure = scenarioData.structure;
    const playfieldsCount = structure.playfields_count || 10;
    
    // Create sample systems based on playfield count
    const systems = [];
    const systemCount = Math.max(3, Math.floor(playfieldsCount / 5));
    
    for (let i = 0; i < systemCount; i++) {
        systems.push({
            Name: `System ${i + 1}`,
            Playfields: [`Playfield${i}_1`, `Playfield${i}_2`],
            Coordinates: {
                x: (Math.random() - 0.5) * 200,
                y: (Math.random() - 0.5) * 50,
                z: (Math.random() - 0.5) * 200
            }
        });
    }
    
    return {
        SolarSystems: systems
    };
}

// Convert generation parameters to solar systems for visualization
function convertGenerationParamsToSolarSystems(config) {
    const params = config.GenerationParams;
    if (!params) return generateSampleGalaxyData();
    
    const systems = [];
    
    // Create systems based on planet types
    if (params.PlanetTypes) {
        params.PlanetTypes.forEach((planetType, index) => {
            // Skip gas giants and special types for now
            if (planetType.Name && !planetType.Name.includes('Jupiter') && 
                !planetType.Name.includes('Saturn') && !planetType.Name.includes('Neptun')) {
                
                const system = {
                    Name: planetType.Name + ' System',
                    Playfields: planetType.Playfields || [planetType.Name],
                    Coordinates: {
                        x: (Math.random() - 0.5) * 300,
                        y: (Math.random() - 0.5) * 50,
                        z: (Math.random() - 0.5) * 300
                    },
                    PlanetType: planetType.Name,
                    Climate: planetType.Climate || 'Unknown'
                };
                
                systems.push(system);
            }
        });
    }
    
    // Add some space stations and asteroid fields
    if (params.StationTypes) {
        params.StationTypes.forEach((stationType, index) => {
            const system = {
                Name: stationType.Name,
                Playfields: stationType.Playfields || [stationType.Name],
                Coordinates: {
                    x: (Math.random() - 0.5) * 300,
                    y: (Math.random() - 0.5) * 50,
                    z: (Math.random() - 0.5) * 300
                },
                Type: 'Station'
            };
            systems.push(system);
        });
    }
    
    console.log(`Created ${systems.length} systems from generation parameters`);
    
    return {
        SolarSystems: systems
    };
}