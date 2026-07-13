/** Turns a stored phone number into the digits-only format wa.me expects
 * (no spaces, dashes, parentheses or leading "+"), assuming Spain (34) for
 * numbers that don't already carry a "+" or a country code — i.e. a plain
 * 9-digit Spanish number. Anything longer than 9 digits is assumed to
 * already include a country code and is left as-is. */
export function normalizePhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) return cleaned.slice(1);
  if (/^\d{9}$/.test(cleaned)) return `34${cleaned}`;
  return cleaned;
}

/** Builds a wa.me deep link with the message pre-filled — opens WhatsApp Web
 * or the app with the chat and text ready to review, never sends anything on
 * its own (that's always the business's own tap on "Send" inside WhatsApp).
 * No official WhatsApp Business API involved: this is the only WhatsApp
 * integration point in the app, so swapping it for the real API later means
 * changing this one function, not every call site. */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = normalizePhoneForWhatsApp(phone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
