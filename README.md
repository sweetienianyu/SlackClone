# SlackClone - Enterprise Real-time Collaboration Platform

A Slack-inspired office collaboration platform supporting multi-workspace, real-time messaging, @mentions, emoji reactions, file sharing, and more.

## Tech Stack

| Layer | Technology | Description |
|-------|-----------|-------------|
| Frontend | React 18 + TypeScript | Component-based development with type safety |
| State Management | Zustand | Lightweight state management |
| Styling | Tailwind CSS 3 | Utility-first CSS for rapid iteration |
| Build Tool | Vite 5 | Lightning-fast HMR |
| Real-time Communication | Socket.IO | WebSocket bidirectional communication |
| Backend | Express + TypeScript | RESTful API |
| Database | SQLite (Prisma ORM) | Lightweight relational DB, zero-config setup |
| Authentication | JWT + bcryptjs | Secure token auth & password hashing |

## Features

### User System
- Email registration / login
- Profile editing (avatar, display name, custom status)
- Real-time online status sync (online / away / busy / offline)

### Workspace Management
- Create / switch between multiple workspaces
- Invite members via invite code
- Member management panel (admins can invite/remove members)
- Role-based access control (admin / member)

### Channel System
- Public channels & private channels
- Direct messages (DM) one-on-one chat
- Channel search
- Create and join channels

### Messaging
- Real-time message delivery via WebSocket
- **@mentions**: Type `@` to trigger member autocomplete; mentioned users receive real-time notifications
- **Emoji reactions**: 32+ emoji reactions with hover-to-view user list
- **Thread replies**: In-depth discussions on any message
- Message edit / delete
- File upload & preview
- Typing indicators
- Messages grouped by date

### Additional Features
- Global search (Cmd/Ctrl + K)
- Notification panel (aggregated @mentions)
- Three-column layout (sidebar / channel list / message area)

## Project Structure

```
SlackApp/
├── client/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── channel-list/   # Channel list component
│   │   │   ├── layout/         # App layout
│   │   │   ├── message-area/   # Messages + input + emoji picker
│   │   │   ├── search/         # Global search modal
│   │   │   └── sidebar/        # Left sidebar (workspace switcher, profile)
│   │   ├── lib/                # Utilities (socket, utils)
│   │   ├── pages/              # Pages (login, register, workspace home)
│   │   ├── services/           # API service layer
│   │   ├── stores/             # Zustand state stores
│   │   └── types/              # TypeScript type definitions
│   └── package.json
│
└── server/                     # Node.js backend
    ├── prisma/
    │   └── schema.prisma       # Database schema definition
    └── src/
        ├── config/             # Config (JWT, etc.)
        ├── middleware/          # Middleware (auth)
        ├── routes/             # Routes (auth, workspaces, channels, messages, files, search)
        ├── socket/             # Socket.IO real-time communication
        └── index.ts            # Entry point
```

## Quick Start

### Prerequisites

- Node.js >= 18
- npm >= 9

### Install Dependencies

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### Run the Project

```bash
# Terminal 1 - Start backend (port 3001)
cd server
npx prisma db push          # Initialize database
npx tsx src/index.ts

# Terminal 2 - Start frontend (port 5173)
cd client
npm run dev
```

Open http://localhost:5173 in your browser.

### Test Account

Register with any email to create an account and enter a workspace.

## Database Schema

```
User          ←→ WorkspaceMember → Workspace
User          ←→ ChannelMember   → Channel
User          ←→ Message         → Channel
Message       ←→ Reaction         ← User
Message       ←→ Message (Thread)
Workspace     ←→ Channel
Channel       ←→ Message
```

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| PUT | `/api/auth/profile` | Update profile |
| GET | `/api/workspaces` | List workspaces |
| POST | `/api/workspaces` | Create workspace |
| POST | `/api/workspaces/join` | Join by invite code |
| GET | `/api/workspaces/:id/members` | Get workspace members |
| POST | `/api/workspaces/:id/invite` | Invite member |
| DELETE | `/api/workspaces/:id/members/:userId` | Remove member |
| GET | `/api/channels?workspace_id=` | List channels |
| POST | `/api/channels` | Create channel |
| GET | `/api/messages?channel_id=` | Get messages |
| POST | `/api/messages` | Send message |
| PUT | `/api/messages/:id` | Edit message |
| DELETE | `/api/messages/:id` | Delete message |
| POST | `/api/messages/:id/reactions` | Toggle emoji reaction |
| GET | `/api/messages/:id/thread` | Get thread replies |
| POST | `/api/files/upload` | Upload file |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `channel:join` | Client → Server | Join a channel room |
| `message:new` | Server → Client | New message notification |
| `message:update` | Server → Client | Message updated (edit/reaction) |
| `message:delete` | Server → Client | Message deleted |
| `notification:mention` | Server → Client | @mention real-time notification |
| `user:typing` | Bidirectional | Typing indicator |

## License

MIT
