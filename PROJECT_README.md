# YouTube Music Rating App

A comprehensive Angular web application that allows users to import YouTube Music playlists, rate songs from 1-10, and export filtered playlists back to their YouTube Music account.

## ✨ Features

### 🎵 Core Functionality
- **Import Playlists**: Import your playlists from YouTube Music
- **Rate Songs**: Rate each song on a scale of 1-10
  - 1 = Terrible
  - 10 = Masterpiece
- **Persistent Ratings**: All ratings are stored locally and persist between sessions
- **Export Playlists**: Create and export filtered playlists based on ratings
  - Export all songs (1-10)
  - Export highly rated songs (7-10)
  - Export only excellent songs (9-10)
  - Export only masterpieces (10)
  - Custom rating ranges

### 📊 Additional Features
- Rating distribution visualization
- Progress tracking during rating sessions
- Navigate back and forth between songs
- Skip unrated songs
- Edit existing ratings
- Clean, modern, responsive UI

## 🚀 Getting Started

The application is now running at **http://localhost:4200/**

### To use the app:

1. **Login**: Click "Sign in with YouTube Music" (uses mock auth for now)
2. **Import**: Select a playlist from the dashboard
3. **Rate**: Rate each song from 1-10
4. **Export**: Filter by rating and export back to YouTube Music

## 📁 Project Structure

```
ytmusic-rating-app/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── login/                 # Authentication component
│   │   │   ├── dashboard/             # Main dashboard
│   │   │   ├── playlist-import/       # Import playlists
│   │   │   ├── song-rating/           # Rate songs interface
│   │   │   └── playlist-export/       # Export filtered playlists
│   │   ├── models/
│   │   │   ├── user.model.ts          # User data structure
│   │   │   ├── song.model.ts          # Song and rating structures
│   │   │   └── playlist.model.ts      # Playlist structures
│   │   ├── services/
│   │   │   ├── auth.service.ts        # Authentication service
│   │   │   ├── storage.service.ts     # Local storage for ratings
│   │   │   └── youtube-music.service.ts # YouTube Music API integration
│   │   ├── app.routes.ts              # Application routing
│   │   └── app.ts                     # Root component
│   └── styles.scss                    # Global styles
└── README.md
```

## 🔧 API Integration (Next Steps)

The application is structured with placeholder methods for YouTube Music API integration. To connect to the real YouTube Music API:

### 1. Authentication (auth.service.ts)
Update the `loginWithYouTube()` method:
```typescript
// Replace mock implementation with:
- YouTube OAuth 2.0 flow
- Token management
- Refresh token handling
```

### 2. YouTube Music Service (youtube-music.service.ts)
Replace mock methods with actual API calls:
- `getUserPlaylists()` - Fetch user's playlists
- `getPlaylistSongs()` - Get songs from a playlist
- `createPlaylist()` - Create new playlist
- `addSongsToPlaylist()` - Add songs to playlist

### Required API Setup:
1. Register app in Google Cloud Console
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Configure authorized redirect URIs
5. Implement proper error handling

## 💾 Data Storage

Currently uses **localStorage** for ratings:

```typescript
{
  "ytmusic_ratings": {
    "[userId]": {
      "[songId]": {
        "songId": string,
        "userId": string,
        "rating": number,
        "ratedAt": Date
      }
    }
  }
}
```

### For Production:
- Move to backend database (PostgreSQL/MongoDB)
- Implement proper user authentication
- Enable cloud sync across devices

## 🛠️ Technology Stack

- **Framework**: Angular 20+
- **Language**: TypeScript
- **Styling**: SCSS with gradient themes
- **State Management**: RxJS
- **Storage**: LocalStorage (upgradeable to backend)
- **Routing**: Angular Router

## 📱 UI/UX Features

- Modern gradient design (purple/blue theme)
- Fully responsive (mobile-friendly)
- Smooth transitions and animations
- Intuitive rating interface
- Visual feedback on interactions
- Progress tracking
- Rating distribution charts

## 🎨 Components Overview

### Login Component
- YouTube Music authentication
- Welcome screen with feature list
- Mock auth for development

### Dashboard
- User welcome message
- Total ratings count
- Three main action cards:
  - Import Playlist
  - View & Edit Ratings
  - Export Playlist

### Playlist Import
- Grid view of user's playlists
- Detailed song list for selected playlist
- Song metadata display (title, artist, album, duration)

### Song Rating
- Large album art display
- Song information
- 1-10 rating buttons with hover effects
- Progress bar
- Navigation (previous/next/skip)
- Rating labels (Terrible → Masterpiece)

### Playlist Export
- Rating distribution bar chart
- Preset filter options
- Custom range selector
- Filtered songs preview
- Playlist naming and description
- Export confirmation

## 🚦 Development Commands

```bash
# Start development server
ng serve

# Build for production
ng build

# Run tests
ng test

# Lint code
ng lint
```

## 📝 Notes

- Currently using mock data for development
- All ratings stored in browser localStorage
- Clearing browser data will erase ratings
- Ready for YouTube Music API integration

## 🔮 Future Enhancements

- [ ] YouTube Music API integration
- [ ] Backend API implementation
- [ ] User authentication system
- [ ] Multi-device sync
- [ ] Playlist analytics
- [ ] Bulk rating operations
- [ ] Export ratings as CSV/JSON
- [ ] Social features (share playlists)
- [ ] Music recommendations
- [ ] Dark mode theme
- [ ] Spotify integration
- [ ] Apple Music integration

## 📄 License

Custom application - modify as needed for your use case.

---

**Status**: Development (API integration pending)  
**Version**: 1.0.0  
**Last Updated**: October 2025

## 🆘 Support

When integrating the YouTube Music API:
1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable YouTube Data API v3
4. Create OAuth 2.0 credentials
5. Update service methods with actual API calls
6. Handle rate limiting and errors appropriately

**Application is now running at: http://localhost:4200/**
