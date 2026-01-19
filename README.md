# Image Generator - Static Version

This is a **static, client-side** version of the Tutero Image Generator that can be deployed to **GitHub Pages** or any static hosting service.

## 🌟 Features

- **Pure Client-Side**: No backend server required - runs entirely in the browser
- **Direct API Integration**: Connects directly to OpenRouter API from the browser
- **Local Storage**: API keys and history stored securely in browser localStorage
- **Fully Responsive**: Works on desktop, tablet, and mobile devices
- **GitHub Pages Ready**: Can be deployed instantly to GitHub Pages

## 🚀 Quick Start

### Option 1: Local Development

1. **Open the file directly in your browser**:
   ```bash
   open index.html
   ```
   
   Or use a simple HTTP server:
   ```bash
   # Python 3
   python3 -m http.server 8000
   
   # Node.js (if you have npx)
   npx serve
   ```

2. **Enter your OpenRouter API Key**:
   - Click on "API Key" in the sidebar
   - Enter your OpenRouter API key (get one at https://openrouter.ai)
   - The key is stored locally in your browser

3. **Generate Images**:
   - Select an image type
   - Choose orientation, count, and model
   - Describe your image
   - Click "Generate Images"

### Option 2: Deploy to GitHub Pages

1. **Create a new GitHub repository** or use an existing one

2. **Push the static files**:
   ```bash
   git add index.html static/
   git commit -m "Add static image generator"
   git push origin main
   ```

3. **Enable GitHub Pages**:
   - Go to your repository settings
   - Navigate to "Pages" section
   - Select "main" branch as source
   - Click "Save"

4. **Access your site**:
   - Your site will be available at: `https://[username].github.io/[repo-name]/`

## 📁 File Structure

```
image-generator/
├── index.html              # Main HTML file
├── static/
│   ├── css/
│   │   └── style.css       # Styles
│   ├── js/
│   │   ├── app.js          # Main application logic
│   │   ├── api.js          # API integration
│   │   ├── config.js       # Configuration
│   │   └── promptBuilder.js # Prompt building logic
│   └── images/
│       └── tutero-logo.png # Logo
└── reference_images/       # Reference images for character consistency
```

## 🔑 API Key Setup

This application requires an **OpenRouter API key** to generate images.

1. **Get an API Key**:
   - Visit https://openrouter.ai
   - Sign up or log in
   - Navigate to "Keys" section
   - Create a new API key

2. **Add Credits**:
   - Add credits to your OpenRouter account
   - Image generation costs vary by model

3. **Enter Key in App**:
   - Click "API Key" in the sidebar
   - Paste your key (starts with `sk-or-...`)
   - Key is stored in browser localStorage (never sent to any server except OpenRouter)

## 🎨 Image Categories

1. **Subtopic Cover**: Educational cover images for math topics
2. **Tutero AI**: AI character in various learning contexts
3. **Classroom Activity**: Students learning with AI assistant
4. **Context Introduction**: Real-world math applications

## 🔒 Security & Privacy

- **API keys are stored locally** in your browser's localStorage
- **No backend server** - all processing happens in your browser
- **Direct API calls** to OpenRouter from your browser
- **History stored locally** - never leaves your device

## ⚙️ Configuration

Edit `static/js/config.js` to customize:
- Available models
- Image dimensions
- Aspect ratios
- Style templates
- API endpoints

## 🛠️ Customization

### Adding New Styles

Edit `static/js/config.js` and add to the `styles` array:

```javascript
{
  id: "my_style",
  name: "My Style",
  description: "Custom style description",
  prompt_template: "Your custom prompt template..."
}
```

### Changing Models

Update the model selection in `static/js/config.js`:

```javascript
api: {
  defaultModel: "google/gemini-2.5-flash-image",
  // ... other config
}
```

## 🌐 Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Requires modern browser with ES6 module support

## 📝 Limitations

Compared to the Python backend version:

- **No server-side processing**: All logic runs in browser
- **CORS restrictions**: Some reference images may not load due to CORS
- **No WebSocket**: Real-time updates not available (uses polling instead)
- **Browser storage limits**: History limited by localStorage size
- **API key exposure**: Key is visible in browser (use with caution on shared devices)

## 🔄 Migration from Python Version

If you were using the Python Flask version:

1. **Export your history** (if needed)
2. **Copy reference images** to `reference_images/` directory
3. **Update API key** in the new interface
4. **Test image generation** with a simple prompt

## 📚 Resources

- [OpenRouter Documentation](https://openrouter.ai/docs)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

## 🐛 Troubleshooting

### Images not generating?
- Check your API key is correct
- Verify you have credits in OpenRouter
- Check browser console for errors
- Try a different model

### Reference images not loading?
- Ensure images are in `reference_images/` directory
- Check file paths in `api.js`
- Verify CORS headers if hosting externally

### History not saving?
- Check browser localStorage is enabled
- Clear browser cache and try again
- Check browser console for errors

## 📄 License

Same as the original Python version.

## 🤝 Contributing

Contributions welcome! Please test thoroughly before submitting PRs.

---

**Note**: This is a simplified, client-side version. For production use with sensitive data, consider using the Python backend version with proper authentication and security measures.
