import { defineCollection, z } from 'astro:content';

const writingCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    publishDate: z.date(),
    author: z
      .object({
        name: z.string(),
        email: z.string().email().optional(),
      })
      .default({ name: 'Andrew Ginns' }),
    tags: z.array(z.string()),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
  }),
});

const projectCollection = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    description: z.string(),
    github: z.string().url().optional(),
    demo: z.string().url().optional(),
    technologies: z.array(z.string()),
    featured: z.boolean().default(false),
    status: z.enum(['active', 'archived', 'maintained']).default('active'),
  }),
});

export const collections = {
  writing: writingCollection,
  projects: projectCollection,
};
