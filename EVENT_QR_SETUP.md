# LumaLink Event QR

Event QR codes are **static calendar QR codes**. The complete iCalendar event is embedded directly in the QR payload; there is no redirect, hosted event page, or public URL dependency.

## Flow

1. User enters the event details.
2. The frontend builds a compact `VCALENDAR` / `VEVENT` payload.
3. The QR preview encodes that calendar payload directly.
4. `POST /api/qr` stores the event as a non-dynamic QR and keeps the same calendar payload in `destination`.
5. Samsung, Android, iPhone, or another QR reader decides whether to offer a calendar action for the decoded iCalendar content.

## Compatibility-focused payload

The generated event contains only the fields needed for a useful single event:

- `BEGIN:VCALENDAR`
- `VERSION:2.0`
- `PRODID`
- `BEGIN:VEVENT`
- `UID`
- `DTSTAMP`
- `DTSTART` / `DTEND` in UTC
- `SUMMARY`
- optional `LOCATION`
- optional `DESCRIPTION`
- `END:VEVENT`
- `END:VCALENDAR`

Lines use CRLF endings and are folded at 75 UTF-8 octets for stricter iCalendar parsers.

## Scan-safety guidance

Event payloads are longer than URL payloads. Keep descriptions short, use a light background with strong contrast, preserve a generous quiet zone, and keep center logos small. The client Scan Safety panel also reports Event payload size and warns when the payload becomes dense.

The score is a design heuristic, not a guaranteed probability of successful scanning. Actual behavior still depends on the phone, camera, scanner, calendar app, lighting, display/print size, and QR styling.
