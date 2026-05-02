import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env['DATABASE_URL'] ?? 'postgresql://lifeos:lifeos123@172.22.201.52:5432/lifeos',
  },
});
