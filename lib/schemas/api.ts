import { z } from "zod";
import { PERSONAS, PersonaSlugSchema } from "./findings";

export const LoginRequestSchema = z.object({
  email: z.string().min(1).max(256),
  password: z.string().min(1).max(256),
});

export const CreateRunRequestSchema = z.object({
  personas: z.array(PersonaSlugSchema).min(1).max(PERSONAS.length).default([...PERSONAS]),
  note: z.string().max(500).optional(),
});

export const CancelRunRequestSchema = z.object({
  status: z.literal("cancelled"),
});
