#!/usr/bin/env node
/**
 * A local mail catcher for development and demos.
 *
 * The API already speaks SMTP through nodemailer; with no SMTP_HOST set it
 * falls back to logging the message body instead of sending it. That is fine
 * for a unit test and poor for a demo: the reset link ends up buried in the
 * API's log between request traces, and there is nothing to show an audience.
 *
 * So rather than add a second delivery path to the API, this gives it a real
 * SMTP server to talk to -- one that accepts everything and delivers nothing.
 * The message is printed here, with any link in it pulled out and shown on its
 * own line, because the link is the only part anyone needs.
 *
 * Deliberately dependency-free and deliberately bound to the loopback
 * interface: this must never be reachable from another machine, and it must
 * never be something a production deployment could accidentally acquire. For a
 * browsable inbox instead of a terminal, `docker compose --profile dev up -d
 * mailpit` serves one at http://localhost:8025 on the same port 1025.
 */
import net from 'node:net';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

export const MAIL_HOST = '127.0.0.1';
export const defaultMailPort = () => Number(process.env.DEV_MAIL_PORT ?? 1025);

/**
 * Undoes quoted-printable, which nodemailer uses for both the text and HTML
 * parts. Without this a long URL is split across lines by soft breaks and the
 * link cannot be copied out of the terminal in one piece -- the single thing
 * this tool exists to make easy.
 */
function decodeQuotedPrintable(input) {
  return input
    .replace(/=(?:\r\n|\n)/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function headerValue(headers, name) {
  const match = headers.match(new RegExp(`^${name}:[ \\t]*(.*(?:\\r?\\n[ \\t].*)*)`, 'im'));
  return match ? match[1].replace(/\r?\n[ \t]+/g, ' ').trim() : '';
}

/** The text/plain alternative, if this is multipart; otherwise the whole body. */
function readableBody(headers, body) {
  const boundary = headers.match(/boundary="?([^";\r\n]+)"?/i)?.[1];
  if (!boundary) return decodeQuotedPrintable(body);

  for (const part of body.split(`--${boundary}`)) {
    const split = part.indexOf('\r\n\r\n');
    if (split === -1) continue;
    const partHeaders = part.slice(0, split);
    if (/content-type:\s*text\/plain/i.test(partHeaders)) {
      return decodeQuotedPrintable(part.slice(split + 4)).trim();
    }
  }
  return decodeQuotedPrintable(body);
}

function extractLinks(text) {
  // Deep links first: on a phone that is the one that actually opens the app.
  const matches = text.match(/(?:donor:\/\/|https?:\/\/)[^\s<>"'\])]+/g) ?? [];
  return [...new Set(matches)];
}

/** A received message, parsed into the parts anyone actually wants. */
export function parseMessage({ from, to, data }) {
  const split = data.indexOf('\r\n\r\n');
  const headers = split === -1 ? data : data.slice(0, split);
  const body = split === -1 ? '' : data.slice(split + 4);
  const text = readableBody(headers, body);
  return {
    from: headerValue(headers, 'From') || from,
    to,
    subject: headerValue(headers, 'Subject'),
    text,
    links: extractLinks(text),
    receivedAt: new Date(),
  };
}

function printMessage(raw) {
  const { to, from, subject, text, links } = parseMessage(raw);
  const stamp = new Date().toTimeString().slice(0, 8);

  console.log(`\n  ── ${stamp} ${'─'.repeat(52)}`);
  console.log(`  To       ${to.join(', ') || '(none)'}`);
  console.log(`  From     ${from}`);
  console.log(`  Subject  ${subject || '(none)'}`);
  if (links.length) {
    console.log('');
    for (const link of links) console.log(`  → ${link}`);
  }
  console.log('');
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) console.log(`  │ ${line}`);
  }
  console.log(`  ${'─'.repeat(58)}`);
}

/**
 * Just enough SMTP to be talked to.
 *
 * No STARTTLS and no AUTH are advertised, which is what keeps nodemailer from
 * attempting either against a server that has no business handling credentials.
 */
function handleConnection(socket, onMessage) {
  let buffer = '';
  let inData = false;
  let message = { from: '', to: [], data: '' };

  const send = (line) => socket.write(`${line}\r\n`);
  send('220 localhost Bloodchain dev mail sink');

  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');

    for (;;) {
      if (inData) {
        const end = buffer.indexOf('\r\n.\r\n');
        if (end === -1) return;
        // Dot-unstuffing: a body line that began with a period was sent with
        // an extra one so it could not be mistaken for the terminator.
        message.data += buffer.slice(0, end).replace(/\r\n\.\./g, '\r\n.');
        buffer = buffer.slice(end + 5);
        inData = false;
        onMessage(message);
        message = { from: '', to: [], data: '' };
        send('250 2.0.0 Ok: queued');
        continue;
      }

      const newline = buffer.indexOf('\r\n');
      if (newline === -1) return;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 2);
      const verb = line.slice(0, 4).toUpperCase();

      if (verb === 'EHLO') {
        send('250-localhost');
        send('250-8BITMIME');
        send('250 SMTPUTF8');
      } else if (verb === 'HELO') {
        send('250 localhost');
      } else if (verb === 'MAIL') {
        message.from = line.match(/<([^>]*)>/)?.[1] ?? '';
        send('250 2.1.0 Ok');
      } else if (verb === 'RCPT') {
        const address = line.match(/<([^>]*)>/)?.[1];
        if (address) message.to.push(address);
        send('250 2.1.5 Ok');
      } else if (verb === 'DATA') {
        inData = true;
        send('354 End data with <CR><LF>.<CR><LF>');
      } else if (verb === 'RSET') {
        message = { from: '', to: [], data: '' };
        send('250 2.0.0 Ok');
      } else if (verb === 'NOOP') {
        send('250 2.0.0 Ok');
      } else if (verb === 'QUIT') {
        send('221 2.0.0 Bye');
        socket.end();
        return;
      } else {
        send('502 5.5.1 Command not implemented');
      }
    }
  });

  socket.on('error', () => socket.destroy());
}

/**
 * Starts a sink and hands back the messages it catches.
 *
 * Used both by the CLI below and by `recovery-verify.mjs`, which needs to read
 * a reset link rather than look at one.
 */
export function createMailSink({ port = defaultMailPort(), onMessage } = {}) {
  const messages = [];
  const waiters = [];
  // How far `next()` has read. The API sends the mail *inside* the request that
  // asks for it, so by the time a caller has the HTTP response the message has
  // already arrived -- a `next()` that only watched for future messages would
  // wait out its timeout holding the answer it was waiting for.
  let cursor = 0;

  const deliver = (raw) => {
    const parsed = parseMessage(raw);
    messages.push(parsed);
    onMessage?.(parsed, raw);
    while (waiters.length && cursor < messages.length) {
      waiters.shift()(messages[cursor++]);
    }
  };

  const server = net.createServer((socket) => handleConnection(socket, deliver));

  return {
    messages,
    /** Resolves with the next unread message, or rejects if none arrives in time. */
    next(timeoutMs = 5000) {
      if (cursor < messages.length) return Promise.resolve(messages[cursor++]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const index = waiters.indexOf(resolve);
          if (index !== -1) waiters.splice(index, 1);
          reject(new Error(`No message received within ${timeoutMs}ms`));
        }, timeoutMs);
        waiters.push((message) => {
          clearTimeout(timer);
          resolve(message);
        });
      });
    },
    listen() {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, MAIL_HOST, () => resolve(server));
      });
    },
    close() {
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

// Run as a CLI only when executed directly, so importing this module for its
// sink does not also start a server and print a banner.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  // Belt and braces. Nothing should ever start this on a production host, but a
  // mail server that silently swallows every message is the kind of thing that
  // must refuse rather than assume.
  if (process.env.NODE_ENV === 'production') {
    console.error('  ✗ dev-mail refuses to run with NODE_ENV=production.');
    process.exit(1);
  }

  const port = defaultMailPort();
  const sink = createMailSink({ port, onMessage: (_parsed, raw) => printMessage(raw) });

  try {
    await sink.listen();
    console.log(`\n  Bloodchain dev mail — catching everything on ${MAIL_HOST}:${port}`);
    console.log('  Nothing is delivered. Messages, and any link inside them, are printed here.');
    console.log(`  Start the API with SMTP_HOST=127.0.0.1 SMTP_PORT=${port} (pnpm demo:start does it).\n`);
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `\n  ✗ Port ${port} is already in use — another mail catcher (or Mailpit) is probably running.\n` +
          '    That is fine: the API only needs something listening there.\n',
      );
      process.exit(1);
    }
    throw error;
  }

  const stop = () => {
    sink.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
