# HTML

A modern HTML project utilizing Tailwind CSS for building responsive web applications with minimal setup.

## 🚀 Features

- **HTML5** - Modern HTML structure with best practices
- **Tailwind CSS** - Utility-first CSS framework for rapid UI development
- **Custom Components** - Pre-built component classes for buttons and containers
- **NPM Scripts** - Easy-to-use commands for development and building
- **Responsive Design** - Mobile-first approach for all screen sizes

## 📋 Prerequisites

- Node.js (v12.x or higher)
- npm or yarn

## 🛠️ Installation

1. Install dependencies:
```bash
npm install
# or
yarn install
```

2. Start the development server:
```bash
npm run dev
# or
yarn dev
```

## 🧩 CMS (Content Management System)

This project includes a simple built-in CMS powered by Node.js + Express.

### Run the CMS server

```bash
npm run cms
```

- Windows (no terminal): double-click `Start-CMS.bat`

- Website: `http://localhost:3000/`
- Admin CMS: `http://localhost:3000/admin/`

### Default login

- Username: `admin`
- Password: `admin123`

Change the password immediately in **Account** inside the CMS.

### Environment variables (optional)

- `PORT` (default `3000`)
- `CMS_ADMIN_USERNAME` / `CMS_ADMIN_PASSWORD` (only used to create the first admin user)
- `CMS_SESSION_SECRET` (recommended; otherwise a random one is generated each run)
- `CMS_COOKIE_SECURE` (`true` on HTTPS deployments)
- `CMS_DATA_DIR` or `CMS_DB_PATH` (where the CMS stores `db.json`)
- `CMS_UPLOADS_DIR` / `CMS_UPLOADS_URL_PREFIX` (where uploads are stored + the public URL prefix)

You can copy `.env.example` to `.env` and edit values.

### Data storage

By default:

- Content is stored in `cms/data/db.json`
- Uploads are stored in `public/uploads/`

For hosted deployments, use a persistent disk/volume and set `CMS_DATA_DIR` + `CMS_UPLOADS_DIR` so content/uploads don’t reset on redeploy.

### Sell/hand-off tip

If you don’t want the new owner to run commands, set this up once on their computer and pin a shortcut to `Start-CMS.bat`. They can then just open the CMS at `http://localhost:3000/admin/`.

## 📁 Project Structure

```
html_app/
├── css/
│   ├── tailwind.css   # Tailwind source file with custom utilities
│   └── main.css       # Compiled CSS (generated)
├── pages/             # HTML pages
├── index.html         # Main entry point
├── package.json       # Project dependencies and scripts
└── tailwind.config.js # Tailwind CSS configuration
```

## 🎨 Styling

This project uses Tailwind CSS for styling. Custom utility classes include:


## 🧩 Customization

To customize the Tailwind configuration, edit the `tailwind.config.js` file:


## 📦 Build for Production

Build the CSS for production:

```bash
npm run build:css
# or
yarn build:css
```

## 📱 Responsive Design

The app is built with responsive design using Tailwind CSS breakpoints:

- `sm`: 640px and up
- `md`: 768px and up
- `lg`: 1024px and up
- `xl`: 1280px and up
- `2xl`: 1536px and up

## 🙏 Acknowledgments

- Built with [@rtyqueen.Ug](kingartyqueen@gmail.com)
- Powered by HTML and Tailwind CSS

Built by @rtyqueen.Ug ❤️
