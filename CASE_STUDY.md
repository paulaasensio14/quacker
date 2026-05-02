# Quacker Case Study

Quacker is a personal entertainment dashboard for tracking movies, TV shows, books, and video games in one place.

It was built as a portfolio-first product project, but approached with the same standards I would apply to a real SaaS product: clear architecture, stable user flows, manual QA, responsive design, dark mode, external API integrations, and product-oriented iteration.

---

## Overview

Quacker helps users manage their personal entertainment backlog across different media types.

The app allows users to:

- discover movies, TV shows, books, and video games
- save content to a personal library
- organize custom private lists
- track progress depending on content type
- review recent activity
- use a dashboard with metrics and challenges
- manage a basic profile
- switch between light and dark mode

The project was built with vanilla JavaScript, custom CSS, Node.js, Express, and external API integrations.

---

## The problem

Entertainment tracking is usually fragmented.

A person may track:

- movies in one app
- TV shows somewhere else
- books in another platform
- video games manually or not at all
- personal lists across notes, spreadsheets, or bookmarks

Quacker explores the idea of a unified personal entertainment hub.

The product challenge was to support multiple content domains while keeping the experience simple, visual, and consistent.

The technical challenge was to build this without a frontend framework, while still keeping the code modular, testable, and maintainable.

---

## Product goals

The main goals for Quacker v1 were:

- build a complete product experience, not just isolated screens
- support four content types: movies, TV shows, books, and video games
- create a polished landing page and authenticated dashboard
- integrate real external data sources
- persist user data through a backend API
- support progress tracking by content type
- create custom private lists
- keep Explore, Library, Lists, Detail, and Home synchronized
- deliver a responsive UI
- deliver a solid dark mode
- prepare the project for portfolio presentation

The goal was not to add every possible feature, but to close the core v1 experience properly.

---

## My role

I worked on Quacker as:

- frontend engineer
- product designer
- software architect
- QA reviewer
- product owner

This included:

- defining the product scope
- designing the UI system
- building the frontend architecture
- implementing backend endpoints
- integrating external APIs
- debugging data synchronization issues
- improving responsive behavior
- polishing dark mode
- reviewing regressions
- preparing the project for portfolio use

---

## Tech stack

### Frontend

- HTML
- Custom CSS
- Vanilla JavaScript
- Modular JavaScript files
- Manual DOM rendering
- Custom events
- Responsive layout
- Light mode and dark mode

### Backend

- Node.js
- Express
- Cookie-based sessions
- JSON file persistence
- Custom `/api` endpoints

### External APIs

- TMDB for movies and TV shows
- Google Books for books
- RAWG for video games

---

## Core product areas

### Landing page

The landing page introduces Quacker as a personal entertainment dashboard.

It includes:

- hero section
- product messaging
- feature cards
- contact section
- authentication modal
- responsive layout
- dark mode support

The landing page was treated as part of the product, not as a separate marketing afterthought.

### Dashboard Home

The Home view gives users a summary of their activity.

It includes:

- weekly time metrics
- in-progress content
- completed content
- streak information
- continue cards
- recent activity
- monthly challenge
- backlog overview

This view makes the app feel like a product rather than a simple collection manager.

### Explore

Explore allows users to discover content from multiple providers.

It supports:

- weekly featured content
- search
- type filters
- sorting
- movies
- TV shows
- books
- video games
- preview/detail drawer
- add to Library
- add to Lists

A key challenge was keeping the feed balanced across different external providers.

### Detail

The Detail view provides richer information for a selected item.

Depending on the content type, it can show:

- metadata
- summary
- cover/backdrop
- genres
- rating
- providers
- cast
- seasons and episodes
- related items
- library/list state

Books intentionally do not show cast, while TV shows and movies can.

This required type-aware rendering and careful conditional UI.

### Library

Library is where saved content is managed.

It supports:

- filtering
- search
- sorting
- progress states
- progress editing
- type-aware progress rules
- empty states
- responsive card layout

Progress tracking differs by type:

- movies are either not started or completed
- TV shows progress through seasons and episodes
- books progress by pages read
- video games track hours played

### Lists

Lists allow users to organize saved or discovered content into custom private collections.

They include:

- create list
- edit list
- delete list
- card view
- list view
- visual cover previews
- persistent view mode
- list detail page
- search and filters inside list detail
- empty states

Public and collaborative lists were intentionally not included in v1 because they were not fully supported yet.

### Profile

Profile includes basic user information and avatar handling.

It supports:

- profile layout
- avatar selection
- avatar upload entry point
- responsive behavior
- light and dark mode

Profile was kept intentionally minimal for v1 to avoid adding premature settings/features before the main product flows were stable.

---

## Technical architecture

Quacker uses a modular vanilla JavaScript architecture.

The frontend is split by responsibilities:

- data access
- identity helpers
- feature modules
- UI rendering
- event synchronization
- i18n
- dashboard widgets

The app does not use React, Vue, Angular, or a frontend state management library.

Instead, it relies on:

- explicit modules
- manual DOM updates
- local feature state
- shared helpers
- global custom events
- a dedicated API client boundary

This made the project a strong exercise in understanding application architecture without framework abstractions.

---

## `ApiClient` as a boundary

One of the most important architectural decisions was creating `ApiClient` as the boundary between the frontend and data layer.

`ApiClient` handles:

- local mode
- HTTP mode
- backend calls
- request normalization
- library cache
- lists cache
- mutation events
- session-aware requests
- data consistency after mutations

This prevented feature modules from depending directly on backend implementation details.

It also allowed the project to support both local/static usage and full HTTP backend usage.

---

## Canonical identity model

A major issue in multi-source entertainment apps is item identity.

Two items can have the same or similar title but represent different content.

Quacker uses canonical identity based on:

```text
source + externalId