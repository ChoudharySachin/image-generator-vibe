from src.generator_controller import GeneratorController
import sys
import logging
import os

# Ensure we are in the right directory context if needed
# But paths are absolute in code usually.

# Setup basic logging to stdout
logging.basicConfig(level=logging.DEBUG)

print("Initializing Controller...")
try:
    c = GeneratorController()
    print("Starting generation test...")
    # Test a technical topic that triggers my new logic
    res = c.generate('subtopic_cover', 'Multiplication 423 x 24', count=1)
    print("Generation Result:", res['success'], f"Generated: {res['total_generated']}")
    
    if res['images'] and not res['images'][0]['success']:
        print("Image Error:", res['images'][0]['error'])

except Exception as e:
    print("CRASHED:", e)
    import traceback
    traceback.print_exc()
