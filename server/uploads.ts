import type { Express } from "express";
import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import * as db from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { emitRoomEvent } from "./realtime";
import { classifyAttachment } from "../shared/chat-utils";

const uploadTempDirectory = path.join(os.tmpdir(), "chatpht-uploads");
mkdirSync(uploadTempDirectory, { recursive: true });
const upload = multer({ storage: multer.diskStorage({ destination: uploadTempDirectory, filename: (_req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`) }), limits: { fileSize: 1024 * 1024 * 1024 } });

function configured() {
  return Boolean(ENV.cloudinaryCloudName && ENV.cloudinaryApiKey && ENV.cloudinaryApiSecret);
}

export function registerUploadRoutes(app: Express) {
  cloudinary.config({ cloud_name: ENV.cloudinaryCloudName, api_key: ENV.cloudinaryApiKey, api_secret: ENV.cloudinaryApiSecret, secure: true });

  app.post("/api/uploads", upload.single("file"), async (req, res) => {
    try {
      if (!configured()) return res.status(503).json({ error: "Cloudinary is not configured" });
      const user = await sdk.authenticateRequest(req as any);
      const roomId = Number(req.body.roomId);
      const clientMessageId = typeof req.body.clientMessageId === "string" ? req.body.clientMessageId.slice(0, 80) : undefined;
      const file = req.file;
      if (!Number.isInteger(roomId) || !file) return res.status(400).json({ error: "roomId and file are required" });
      if (!(await db.getRoomMembership(roomId, user.id))) return res.status(403).json({ error: "Not a room member" });

      const result = await cloudinary.uploader.upload(file.path, { folder: `chatpht/rooms/${roomId}`, resource_type: "auto", use_filename: true, unique_filename: true, chunk_size: 20_000_000 });
      const message = await db.createMessage({
        roomId,
        senderId: user.id,
        clientMessageId,
        body: file.originalname,
        kind: classifyAttachment(file.mimetype),
        attachmentUrl: result.secure_url,
        attachmentName: file.originalname,
        attachmentMimeType: file.mimetype,
        attachmentSize: file.size,
      });
      emitRoomEvent(roomId, "message:new", message);
      res.status(201).json({ message });
    } catch (error) {
      console.error("[Upload] Failed", error);
      res.status(500).json({ error: "Unable to upload file" });
    } finally {
      if (req.file?.path) await unlink(req.file.path).catch(() => undefined);
    }
  });

  app.post("/api/profile/avatar", upload.single("file"), async (req, res) => {
    try {
      if (!configured()) return res.status(503).json({ error: "Cloudinary is not configured" });
      const user = await sdk.authenticateRequest(req as any);
      const file = req.file;
      if (!file || !file.mimetype.startsWith("image/")) return res.status(400).json({ error: "An image file is required" });
      if (file.size > 5 * 1024 * 1024) return res.status(413).json({ error: "Avatar must be 5 MB or smaller" });
      const result = await cloudinary.uploader.upload(file.path, { folder: `chatpht/avatars`, public_id: `user-${user.id}`, resource_type: "image", overwrite: true, transformation: [{ width: 512, height: 512, crop: "fill", gravity: "face" }] });
      const updatedUser = await db.updateUserAvatar(user.id, result.secure_url);
      res.status(201).json({ user: updatedUser });
    } catch (error) {
      console.error("[Avatar] Failed", error);
      res.status(500).json({ error: "Unable to upload avatar" });
    } finally {
      if (req.file?.path) await unlink(req.file.path).catch(() => undefined);
    }
  });
}
