# Quacker

Quacker is a personal entertainment dashboard for tracking movies, TV shows, books, and video games in one place.

It started as a frontend portfolio project and evolved into a full product-style web application with authentication, a custom backend API, persistent data, external content integrations, progress tracking, custom lists, activity history, notifications, and a responsive light/dark interface.

The goal of Quacker is not only to show UI work, but to demonstrate product thinking, frontend architecture, state synchronization, data modeling, and practical execution without relying on a frontend framework.

---

## Product preview

### Landing

![Quacker landing hero](screenshots/landing-hero.png)

### Dashboard

![Quacker dashboard home light mode](screenshots/dashboard-home-light.png)

![Quacker dashboard home dark mode](screenshots/dashboard-home-dark.png)

### Explore

![Quacker explore view](screenshots/explore.png)

### Detail

![Quacker detail view](screenshots/detail.png)

### Library

![Quacker library view](screenshots/library.png)

### Lists

![Quacker lists view](screenshots/lists.png)

---

## What Quacker does

Quacker helps users organize their personal entertainment backlog across multiple content types:

- Movies
- TV shows
- Books
- Video games

Users can discover content, save items to their library, track progress, organize custom lists, review recent activity, and manage a basic profile.

---

## Main features

### Public landing page

- Public marketing-style landing page
- Authentication modal
- Light mode and dark mode
- Responsive layout
- Contact section

### Dashboard

- Home dashboard with metrics
- Continue section
- Backlog overview
- Recent activity
- Monthly challenge
- Notification panel
- Profile access
- Language switcher
- Light mode and dark mode

### Explore

- Search and discovery across multiple content sources
- Weekly featured content
- Movies and TV shows from TMDB
- Books from Google Books
- Video games from RAWG
- Type filters and sorting
- Detail preview drawer
- Add to Library
- Add to Lists

### Detail view

- Full detail page for each content item
- Metadata by content type
- Providers for supported movie/show data
- Cast for movies and TV shows
- Seasons and episodes for TV shows
- Related content
- Add to Library
- Add to Lists
- Library/list state synchronization

### Library

- Saved personal content
- Filters by type and status
- Search and sorting
- Progress editing by content type:
  - Movies: not started or completed
  - TV shows: season and episode progress
  - Books: pages read
  - Video games: hours played
- Empty states
- Responsive cards
- Dark mode support

### Lists

- Custom private lists
- Create, edit, and delete lists
- Add saved or discovered content to lists
- List overview in card and list modes
- Visual previews with item covers
- List detail view
- Filters and search inside list detail
- Empty states
- Persistent view mode

### Profile

- Basic profile information
- Avatar selection
- Avatar upload entry point
- Responsive profile layout
- Light and dark mode support

---

## Architecture overview

Quacker is built with vanilla JavaScript using a modular frontend architecture.

There is no React, Vue, Angular, or frontend framework. The UI is rendered manually through DOM updates, feature modules, shared helpers, and global application events.

The architecture focuses on:

- clear frontend/backend boundaries
- modular JavaScript files
- manual DOM rendering
- feature-level state
- global synchronization events
- canonical item identity
- local mode and HTTP mode
- cache invalidation
- progressive product hardening

---

## Tech stack

### Frontend

- HTML
- Custom CSS
- Vanilla JavaScript
- Modular JavaScript files
- Manual DOM rendering
- Responsive design
- Light mode / dark mode
- Basic accessibility patterns

### Backend

- Node.js
- Express
- Cookie-based sessions
- JSON file persistence
- Custom `/api` endpoints
- External API adapters

### External integrations

- TMDB
- Google Books
- RAWG

---

## Key technical decisions

### Vanilla JavaScript architecture

Quacker intentionally avoids frontend frameworks.

This makes the project a stronger demonstration of core frontend skills:

- DOM ownership
- rendering flow
- event handling
- state synchronization
- UI feedback
- module boundaries
- progressive refactoring

### `ApiClient` as a frontend boundary

The frontend communicates with data through a dedicated `ApiClient`.

`ApiClient` handles:

- local mode
- HTTP mode
- backend requests
- session-aware API calls
- library cache
- lists cache
- mutation events
- data normalization

This keeps feature modules from talking directly to backend details.

### Canonical item identity

Content items use a canonical identity based on:

```text
source + externalId
