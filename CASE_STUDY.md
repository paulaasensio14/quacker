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

````md
```text
source + externalId
```

Examples:

```text
tmdb + 550
google_books + volume-id
rawg + game-id
```

This identity model is used across:

* Explore
* Detail
* Library
* Lists
* Home
* progress updates
* list membership
* duplicate prevention

This was critical for avoiding false matches between remakes, adaptations, games, books, and similarly named content.

---

## Event-based synchronization

Because the project does not use a framework store, synchronization is handled through global custom events.

This allows separate views to update after mutations.

Examples:

* adding an item to Library updates Explore, Detail, Library, and Home
* adding an item to a list updates Lists and Detail counters
* editing progress updates Library, Home, and activity data
* deleting list content updates list detail and overview

This event-based approach keeps modules decoupled while still allowing the app to behave like a unified product.

---

## Backend architecture

The backend uses Express and exposes a custom `/api`.

It handles:

* authentication
* session cookies
* library persistence
* lists persistence
* activities
* notifications
* profile data
* Explore data
* Detail hydration
* external API adapters

Data is stored in `server/db.json` for the v1/demo version.

This is intentionally simple and inspectable.

For a production SaaS version, the JSON persistence layer would be replaced by a real database.

---

## External API integrations

Quacker integrates with three external providers:

### TMDB

Used for:

* movies
* TV shows
* detail data
* cast
* providers
* seasons
* related content

### Google Books

Used for:

* book search
* featured books
* book detail
* metadata such as author and page count

### RAWG

Used for:

* video game search
* featured games
* game detail
* platforms and developer metadata

A key product challenge was normalizing these different APIs into a consistent internal content model.

---

## UX and product decisions

### Different progress rules per type

Progress is not the same for every media type.

A movie does not need partial progress in the same way as a TV show, book, or game.

Quacker uses different progress logic for each content type to avoid forcing every item into the same model.

### Private lists only in v1

Public and collaborative lists are attractive features, but they require deeper product and backend support.

For v1, the product intentionally focuses on private lists to avoid promising features that are not fully implemented.

### Dark mode hierarchy

Dark mode was treated as a real design system problem.

The goal was not to invert colors, but to preserve visual hierarchy:

* page background
* sidebar/shell
* cards
* internal surfaces
* controls
* hover states
* borders

This helped avoid flat dark screens where everything has the same tone.

### Responsive before portfolio

Before writing portfolio material, the app went through responsive QA.

The priority was to avoid presenting screenshots while known mobile regressions were still open.

This included fixes around:

* mobile sidebar/topbar
* Home panels
* Detail cast layout
* Library modals
* Lists card actions
* Profile layout
* Avatar modal hierarchy

---

## Main challenges

### Synchronizing views without a framework

The biggest frontend challenge was keeping multiple views in sync without a central framework store.

Explore, Detail, Library, Lists, List Detail, and Home all depend on shared data relationships.

This required careful handling of:

* item identity
* cache invalidation
* custom events
* local state
* DOM rendering
* action feedback

### Avoiding duplicate content

Because content comes from multiple providers, duplicate prevention could not rely on title matching.

The canonical identity model was necessary to avoid collisions.

### Handling different content types

Movies, TV shows, books, and games have different metadata and progress models.

The UI had to be flexible without becoming generic or confusing.

### External API instability

External APIs can fail, return partial data, or behave differently by query.

The project needed defensive handling, fallbacks, and UI states that do not collapse when one provider fails.

### Manual DOM rendering

Without a framework, rendering must be explicit.

That means more responsibility around:

* event binding
* state updates
* avoiding stale DOM
* preventing duplicate listeners
* keeping accessibility attributes correct
* preserving UI feedback

---

## Quality assurance

Quacker was tested manually across the main product flows.

The final v1 QA pass included:

* Landing
* Auth modal
* Home Dashboard
* Explore
* Detail
* Library
* Lists overview
* List Detail
* Profile
* Avatar modal
* Notification panel
* light mode
* dark mode
* mobile layout around 393px
* desktop layout
* console checks
* backend checks

Key flows tested:

* Explore → Library → Home
* Detail → Lists → List Detail
* Library → Progress → Home
* Lists overview → List Detail → back
* theme switching
* language switching
* mobile navigation

The project was developed with small commits and regression checks after visual or functional changes.

---

## Results

Quacker reached a portfolio-ready v1 state with:

* a complete landing page
* a full dashboard experience
* real external data integrations
* persistent backend data
* robust Library and Lists flows
* type-aware progress tracking
* synchronized views
* dark mode
* responsive layout
* product screenshots
* README documentation
* final regression QA completed

The result is a project that demonstrates more than UI implementation.

It shows the ability to build, stabilize, and present a real product experience.

---

## Trade-offs

### Vanilla JavaScript instead of a framework

Using vanilla JavaScript made the architecture more explicit and educational, but also increased the amount of manual state and DOM work.

This was intentional for portfolio value.

### JSON persistence instead of a database

`server/db.json` is not a production database.

It was chosen because it keeps the v1 simple, inspectable, and easy to run locally.

A production version would need a real database and migration strategy.

### Basic authentication

The current auth system is suitable for local/demo use.

A production SaaS version would require stronger authentication, account recovery, security hardening, and deployment-specific configuration.

### Limited social features

Public profiles, shared lists, and collaborative features were kept out of v1.

This avoided expanding scope before the private personal tracking experience was stable.

### Manual QA

The project currently relies heavily on manual QA.

A future version should add automated tests for critical identity, progress, and API flows.

---

## Future roadmap

Post-v1 improvements could include:

* production database
* stronger authentication
* profile settings
* persistent user preferences
* onboarding flow
* recommendation logic
* import/export tools
* public profile pages
* shared lists
* collaborative lists
* analytics
* deployment hardening
* automated tests
* SaaS validation
* pricing/freemium exploration

These are future directions, not current v1 promises.

---

## What this project demonstrates

Quacker demonstrates:

* frontend architecture without a framework
* modular JavaScript organization
* product-oriented UI decisions
* backend/API integration
* data normalization
* identity modeling
* state synchronization
* responsive design
* dark mode system thinking
* debugging and regression handling
* manual QA discipline
* portfolio storytelling
* SaaS product thinking

It is designed to show not only that I can build screens, but that I can build and stabilize a complete product experience.

---

## Final reflection

Quacker became more than a technical exercise.

It evolved into a realistic product case study covering architecture, UX, product scope, external data, persistence, QA, and portfolio presentation.


The most valuable part of the project was not adding more features, but learning how to close the right ones properly.