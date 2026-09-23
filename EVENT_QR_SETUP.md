# LumaLink Event QR

Event QR codes use an HTTPS landing page instead of embedding raw iCalendar text in the QR payload.

## Flow

1. User enters the event details.
2. `POST /api/qr` creates a dynamic `EVENT` QR record.
3. The server returns `publicUrl` such as `https://backend.example.com/event/abc123`.
4. The QR encodes that short HTTPS URL.
5. Samsung, Android, and iPhone scanners open the event landing page.
6. The page provides an `.ics` calendar download and Google Calendar action.

## Production configuration

Set `PUBLIC_BASE_URL` on the backend to the public HTTPS origin of the backend, for example:

`PUBLIC_BASE_URL=https://your-backend.example.com`

If omitted, the server falls back to the request origin.

The frontend should have `VITE_SERVER_URL` pointing at the same public backend origin so the unsaved Event preview uses the correct host.
