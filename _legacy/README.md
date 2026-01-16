# Image Generator - Educational Content

A web-based image generation system using Google Gemini 2.5 Flash model to create educational images across four categories with maximum transparency and control.

## 📁 Project Structure

```
image-generator/
├── reference_images/          # Your reference images go here
│   ├── subtopic_cover/       # 16:9 (1920x1080) - Educational subtopic covers
│   ├── tutero_ai/            # 9:16 (1080x1920) - AI assistant images
│   ├── classroom_activity/   # 9:16 (1080x1920) - Classroom scenes
│   └── context_introduction/ # 16:9 (1920x1080) - Real-world contexts
├── config/                    # Configuration files
├── src/                       # Source code
├── static/                    # Web UI assets (CSS, JS)
├── templates/                 # HTML templates
├── output/                    # Generated images
└── logs/                      # Generation and debug logs
```

## 🚀 Quick Start

### 1. Set Up Reference Images

Navigate to each category folder in `reference_images/` and:
1. Read the `README.md` for specifications
2. Copy your reference images into the `images/` subfolder
3. Edit `description.txt` to describe the visual style

**Example:**
```bash
# Copy your images
cp ~/my-images/subtopic-*.png reference_images/subtopic_cover/images/

# Edit the description
nano reference_images/subtopic_cover/description.txt
```

### 2. Install Dependencies

```bash
# Create virtual environment (recommended)
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
```

### 3. Configure Environment

The `.env` file is already configured with your API key. You can modify settings if needed:

```bash
nano .env
```

### 4. Run the Web Interface

```bash
python src/app.py
```

Then open your browser to: **http://localhost:5000**

## 🎨 Image Categories

| Category | Aspect Ratio | Resolution | Purpose |
|----------|-------------|------------|---------|
| **Subtopic Cover** | 16:9 | 1920 x 1080 | Educational subtopic covers |
| **Tutero AI** | 1500:1060 | 1500 x 1060 | AI assistant helping students |
| **Classroom Activity** | 1500:1060 | 1500 x 1060 | Students in classroom settings |
| **Context Introduction** | 16:9 | 1920 x 1080 | Real-world applications |

## 🖥️ Using the Web Interface

1. **Select Category** - Choose from the dropdown (4 options)
2. **Enter Instructions** - Describe the image you want to generate
3. **Click Generate** - Creates 4 images automatically
4. **View Results** - Images appear in the gallery with download buttons
5. **Check Debug Panel** - View prompts, logs, and validation details

### Example Prompts

**Subtopic Cover:**
```
Create a cover image for an Algebra unit featuring equations, 
graphs, and mathematical symbols in a modern, vibrant style
```

**Tutero AI:**
```
Show a friendly AI assistant helping a high school student 
solve a geometry problem on a tablet
```

**Classroom Activity:**
```
Diverse group of students collaborating on a math project 
with whiteboards and laptops in a modern classroom
```

**Context Introduction:**
```
Architecture and engineering applications of trigonometry, 
showing bridges and buildings with geometric overlays
```

## 🔍 Transparency & Control Features

- **Dry-Run Mode**: Test without API calls (set `DRY_RUN=true` in `.env`)
- **Detailed Logging**: All operations logged to `logs/` directory
- **Debug Panel**: View exact prompts, API responses, and validation
- **Cost Tracking**: Monitor API usage and estimated costs
- **Generation History**: Review all past generations
- **Validation Reports**: Automatic aspect ratio and quality checks

## 📊 Configuration

### Main Config: `config/default_config.yaml`
- API settings (timeout, retries)
- Generation parameters (4 images per prompt)
- Logging levels
- Validation thresholds
- Cost limits

### Categories: `config/image_categories.yaml`
- Aspect ratios for each category
- Reference image directories
- Category descriptions

## 🧪 Testing

```bash
# Run all tests
pytest tests/ -v

# Test specific component
pytest tests/test_prompt_builder.py -v

# Test with dry-run mode
DRY_RUN=true python src/app.py
```

## 📝 Logs

All operations are logged for debugging:

- **Generation Logs**: `logs/generation_logs/` - High-level workflow
- **Debug Logs**: `logs/debug_logs/` - Detailed technical info
- **Console Output**: Real-time feedback during generation

## 💰 Cost Management

- Set budget limits in `.env` (`MAX_COST_LIMIT`)
- View cost reports in the web UI
- Automatic warnings at 80% of budget
- Dry-run mode for testing without charges

## 🛠️ Troubleshooting

### No images generated
- Check API key in `.env`
- Verify reference images exist in category folders
- Check logs in `logs/debug_logs/`

### Aspect ratio mismatch
- Verify category configuration in `config/image_categories.yaml`
- Check validation tolerance in `config/default_config.yaml`

### Web UI not loading
- Ensure port 5000 is available
- Check Flask debug output in terminal
- Verify all dependencies installed

## 📚 Next Steps

1. **Add Reference Images**: Copy your images to the appropriate folders
2. **Customize Descriptions**: Edit `description.txt` files for each category
3. **Test Generation**: Start with dry-run mode to verify setup
4. **Generate Images**: Use the web interface to create your first batch
5. **Review Results**: Check the debug panel and logs for insights

## 🔐 Security Notes

- **Never commit `.env`** to version control (already in `.gitignore`)
- Change `FLASK_SECRET_KEY` in production
- Keep API keys secure and rotate regularly
- Use environment variables for sensitive data

## 📞 Support

For issues or questions:
1. Check the debug panel in the web UI
2. Review logs in `logs/debug_logs/`
3. Verify configuration in `config/` files
4. Test with dry-run mode enabled

---

**Ready to generate educational images with maximum control and transparency!** 🎓✨
