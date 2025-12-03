"""Flask Web Application for Image Generator"""
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
import os
from pathlib import Path
import threading

from generator_controller import GeneratorController

# Get project root directory (parent of src)
project_root = Path(__file__).parent.parent

# Initialize Flask app with correct template and static folders
app = Flask(__name__,
            template_folder=str(project_root / 'templates'),
            static_folder=str(project_root / 'static'))
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'change-this-in-production')

# Initialize SocketIO
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize generator controller
controller = GeneratorController()

# Store active generation sessions
active_sessions = {}

@app.route('/')
def index():
    """Render main page"""
    return render_template('index.html')

@app.route('/api/categories', methods=['GET'])
def get_categories():
    """Get available image categories"""
    try:
        categories = controller.get_categories()
        
        # Format for frontend
        formatted_categories = []
        for key, config in categories.items():
            formatted_categories.append({
                'id': key,
                'name': config['name'],
                'description': config['description'],
                'aspect_ratio': config['aspect_ratio'],
                'width': config['width'],
                'height': config['height']
            })
        
        return jsonify({
            'success': True,
            'categories': formatted_categories
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/generate', methods=['POST'])
def generate_images():
    """Generate images based on user input"""
    try:
        data = request.json
        
        category = data.get('category')
        user_input = data.get('user_input')
        
        if not category or not user_input:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: category and user_input'
            }), 400
        
        # Get optional parameters
        count = data.get('count', 4)
        selected_models = data.get('selected_models')
        year_level = data.get('year_level', 'Year 8')
        age = data.get('age', 'middle school')
        math_concept = data.get('math_concept', 'mathematical concepts')
        
        # Create session ID
        session_id = controller.logger.session_id
        
        # Progress callback for WebSocket updates
        def progress_callback(current, total, status):
            socketio.emit('generation_progress', {
                'session_id': session_id,
                'current': current,
                'total': total,
                'status': status,
                'percentage': int((current / total) * 100)
            })
            
        # Callback for individual image generation
        def on_image_generated(index, image_info):
            socketio.emit('image_generated', {
                'session_id': session_id,
                'index': index + 1,
                'image': image_info
            })
        
        # Run generation in background thread
        def generate_in_background():
            try:
                result = controller.generate(
                    category=category,
                    user_input=user_input,
                    count=count,
                    progress_callback=progress_callback,
                    selected_models=selected_models,
                    on_image_generated=on_image_generated,
                    year_level=year_level,
                    age=age,
                    math_concept=math_concept
                )
                
                active_sessions[session_id] = result
                
                # Emit completion
                socketio.emit('generation_complete', {
                    'session_id': session_id,
                    'result': result
                })
                
            except Exception as e:
                socketio.emit('generation_error', {
                    'session_id': session_id,
                    'error': str(e)
                })
        
        # Start background thread
        thread = threading.Thread(target=generate_in_background)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Generation started'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/refine', methods=['POST'])
def refine_image():
    """Refine an existing image"""
    try:
        data = request.json
        
        category = data.get('category')
        base_image_path = data.get('base_image_path')
        refinement_instructions = data.get('refinement_instructions')
        index = data.get('index', 0)  # Get index of image being refined
        
        if not category or not base_image_path or not refinement_instructions:
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
            
        # Create session ID
        session_id = controller.logger.session_id
        
        # Progress callback
        def progress_callback(current, total, status):
            socketio.emit('generation_progress', {
                'session_id': session_id,
                'current': current,
                'total': total,
                'status': status,
                'percentage': int((current / total) * 100)
            })
            
        # Callback for refined image generation
        def on_image_generated(generated_index, image_info):
            socketio.emit('image_generated', {
                'session_id': session_id,
                'index': index,  # Use original index to update correct slot
                'image': image_info
            })
            
        # Run refinement in background
        def refine_in_background():
            try:
                result = controller.refine_image(
                    category=category,
                    base_image_path=base_image_path,
                    refinement_instructions=refinement_instructions,
                    progress_callback=progress_callback,
                    on_image_generated=on_image_generated
                )
                
                active_sessions[session_id] = result
                
                socketio.emit('generation_complete', {
                    'session_id': session_id,
                    'result': result
                })
                
            except Exception as e:
                socketio.emit('generation_error', {
                    'session_id': session_id,
                    'error': str(e)
                })
                
        thread = threading.Thread(target=refine_in_background)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'message': 'Refinement started'
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/session/<session_id>', methods=['GET'])
def get_session(session_id):
    """Get session results"""
    if session_id in active_sessions:
        return jsonify({
            'success': True,
            'result': active_sessions[session_id]
        })
    else:
        return jsonify({
            'success': False,
            'error': 'Session not found'
        }), 404

@app.route('/output/<path:filename>')
def serve_image(filename):
    """Serve generated images"""
    output_dir = controller.config.get_output_dir()
    return send_from_directory(output_dir, filename)

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print('Client connected')
    emit('connected', {'message': 'Connected to image generator'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

if __name__ == '__main__':
    # Get configuration
    host = controller.config.get('web.host', '0.0.0.0')
    port = controller.config.get('web.port', 5000)
    debug = controller.config.get('web.debug', True)
    
    print(f"\n{'='*60}")
    print(f"🎨 Image Generator Web Interface")
    print(f"{'='*60}")
    print(f"\n📍 Server starting on: http://localhost:{port}")
    print(f"\n✨ Features:")
    print(f"   • 4 image categories with custom styles")
    print(f"   • Real-time progress updates")
    print(f"   • Automatic validation")
    print(f"   • Detailed logging and debugging")
    print(f"\n🚀 Ready to generate images!")
    print(f"{'='*60}\n")
    
    # Run server
    socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)
