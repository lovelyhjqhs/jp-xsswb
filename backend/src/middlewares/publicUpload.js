import express from 'express';

import { prisma } from '../db/prisma.js';
import { UPLOAD_ROOT, UPLOAD_URL_PREFIX } from '../config/paths.js';

const staticFile = express.static(UPLOAD_ROOT, {
  fallthrough: true,
  maxAge: 0,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store');
  },
});

/** Public files require an active public-media or published-item association. */
export function publicUpload(req, res, next) {
  if (!['GET', 'HEAD'].includes(req.method)) return res.sendStatus(404);
  const url = `${UPLOAD_URL_PREFIX}${req.path}`;
  if (!/^\/uploads\/\d{4}\/\d{2}\/[a-f0-9]{32}\.webp$/.test(url)) return res.sendStatus(404);

  Promise.all([
    prisma.siteMedia.findFirst({ where: { url, visibility: 'public', deletedAt: null }, select: { id: true } }),
    prisma.itemImage.findFirst({
      where: {
        url,
        item: { publicAllowed: true, deletedAt: null, status: 'open' },
      },
      select: { id: true },
    }),
  ])
    .then(([media, itemImage]) => {
      if (!media && !itemImage) return res.sendStatus(404);
      staticFile(req, res, next);
    })
    .catch(next);
}
