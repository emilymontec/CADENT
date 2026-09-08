import crypto from "node:crypto";

/**
 * Cifra/descifra los tokens de GitHubAccount antes de tocar la base de datos.
 * Requerido por ROADMAP.md sección 9/29: "tokens protegidos, cifrados en
 * reposo, nunca en texto plano".
 *
 * Usa AES-256-GCM. TOKEN_ENCRYPTION_KEY debe ser un hex de 32 bytes:
 *   openssl rand -hex 32
 */

const ALGORITHM = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no está configurada. No se pueden cifrar tokens de GitHub."
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY debe ser un hex string de 32 bytes (64 chars).");
  }
  return key;
}

// Formato almacenado: iv:authTag:ciphertext (todo hex), en un solo string.
export function encryptToken(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), ciphertext.toString("hex")].join(":");
}

export function decryptToken(stored: string): string {
  const key = getKey();
  const [ivHex, authTagHex, ciphertextHex] = stored.split(":");
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("Formato de token cifrado inválido.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}
