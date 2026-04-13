# SkyWay Road Trip Weather

SkyWay is a smart travel weather application that provides detailed forecasts along your route based on your estimated time of arrival (ETA). It helps you plan safer and more comfortable road trips by highlighting potential weather hazards like heavy rain, high winds, or extreme temperatures.

## Features

- **Route Planning:** Enter your origin, destination, and any waypoints to calculate your path.
- **ETA-Based Weather:** Fetches weather forecasts for specific locations at the exact time you're expected to be there.
- **14-Day Forecast:** Supports trip planning up to 14 days in advance using a combination of OpenWeatherMap and Open-Meteo.
- **Wind Data:** View wind speeds along your route to stay informed about potential driving hazards.
- **AI Travel Summary:** Get a concise, 4-sentence AI-generated summary of your trip's weather and potential risks.
- **Interactive Map:** Visualize your route and weather conditions with interactive markers and popups.
- **Trip History:** Save your favorite routes to your profile for quick access later.

## Tech Stack

- **Frontend:** React 19, Vite, Tailwind CSS
- **Mapping:** Leaflet, React-Leaflet
- **Weather APIs:** OpenWeatherMap (5-day), Open-Meteo (14-day fallback)
- **AI:** Google Gemini API (@google/genai)
- **Backend/Auth:** Firebase (Authentication & Firestore)
- **Animations:** Motion

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Firebase Project
- OpenWeatherMap API Key (Optional, but recommended for high-res 5-day data)
- Google Gemini API Key

### Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd skyway-road-trip-weather
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add the following:
   ```env
   VITE_OPENWEATHER_API_KEY=your_openweather_key
   VITE_GEMINI_API_KEY=your_gemini_key
   ```

4. Configure Firebase:
   Ensure your `firebase-applet-config.json` contains your Firebase project credentials.

5. Start the development server:
   ```bash
   npm run dev
   ```

## Deployment on Netlify

To deploy this application on Netlify, follow these steps:

1. **Push to GitHub:** Ensure your code is pushed to a GitHub repository.
2. **Connect to Netlify:**
   - Log in to your Netlify account.
   - Click "Add new site" > "Import from an existing project".
   - Select GitHub and choose your repository.
3. **Build Settings:**
   - **Build Command:** `npm run build`
   - **Publish Directory:** `dist`
4. **Environment Variables:**
   Go to **Site settings > Environment variables** and add:
   - `VITE_OPENWEATHER_API_KEY`
   - `VITE_GEMINI_API_KEY`
5. **Firebase Configuration:**
   - Make sure your Firebase project's **Authorized Domains** includes your Netlify URL (e.g., `your-site-name.netlify.app`).
   - You can add this in the Firebase Console under **Authentication > Settings > Authorized Domains**.

## License

This project is licensed under the Apache-2.0 License.
