import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

const ALGO = "aes-256-gcm";
const IV_LEN = 16;
const KEY_LEN = 32;
const SALT_LEN = 32;

function getEncryptionKey(): Buffer {
  const secret = process.env.DEPOSIT_WALLET_ENCRYPTION_KEY;
  if (!secret || secret.length < 16) {
    throw new Error("DEPOSIT_WALLET_ENCRYPTION_KEY must be set and at least 16 chars");
  }
  return scryptSync(secret, "freeboli-deposit", KEY_LEN);
}

/**
 * Cifra la clave privada (base58) para guardarla en DB.
 * Devuelve string "iv_hex:authTag_hex:encrypted_hex".
 */
export function encryptPrivateKey(privateKeyBase58: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([
    cipher.update(privateKeyBase58, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("hex"), authTag.toString("hex"), enc.toString("hex")].join(":");
}

/**
 * Descifra el string guardado y devuelve la clave privada en base58.
 */
export function decryptPrivateKey(encrypted: string): string {
  const parts = encrypted.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted format");
  const [ivHex, authTagHex, encHex] = parts;
  const key = getEncryptionKey();
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return decipher.update(encHex, "hex", "utf8") + decipher.final("utf8");
}

/**
 * Genera un keypair nuevo y devuelve public key (base58) y private key cifrada.
 */
export function createDepositKeypair(): {
  publicKey: string;
  encryptedPrivateKey: string;
} {
  const kp = Keypair.generate();
  const publicKey = kp.publicKey.toBase58();
  const privateKeyBase58 = bs58.encode(kp.secretKey);
  const encryptedPrivateKey = encryptPrivateKey(privateKeyBase58);
  return { publicKey, encryptedPrivateKey };
}

/**
 * Recupera el Keypair de un usuario desde la clave cifrada guardada.
 */
export function getDepositKeypair(encryptedPrivateKey: string): Keypair {
  const privateKeyBase58 = decryptPrivateKey(encryptedPrivateKey);
  return Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
}
