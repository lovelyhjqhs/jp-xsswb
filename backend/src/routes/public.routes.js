import { Router } from 'express';
import {
  canteenDetail,
  canteenList,
  categories,
  lostFoundDetail,
  lostFoundImage,
  lostFoundList,
  mailboxList,
  newsDetail,
  newsList,
  profile,
  robots,
  sitemap,
  queryStatus,
  createCanteenFeedback,
  createMailboxMessage,
  createLostFoundItem,
  createLostFoundInquiry,
} from '../controllers/public.controller.js';
import { validateBody, validateParams, validateQuery } from '../middlewares/validate.js';
import { publicAttachments } from '../middlewares/upload.js';
import { publicQueryLimiter, publicSubmissionLimiter } from '../middlewares/rateLimit.js';
import {
  canteenQuerySchema,
  categoriesQuerySchema,
  idParamSchema,
  itemImageParamSchema,
  lostFoundQuerySchema,
  mailboxQuerySchema,
  monthParamSchema,
  newsIdParamSchema,
  newsQuerySchema,
  queryStatusSchema,
  canteenFeedbackSchema,
  mailboxSubmissionSchema,
  lostFoundSubmissionSchema,
  lostFoundInquirySchema,
} from '../validators/public.validator.js';

const router = Router();

router.get('/robots.txt', robots);
router.get('/sitemap.xml', sitemap);
router.get('/profile', profile);
router.get('/categories', validateQuery(categoriesQuerySchema), categories);
router.get('/news', validateQuery(newsQuerySchema), newsList);
router.get('/news/:idOrSlug', validateParams(newsIdParamSchema), newsDetail);
router.get('/canteen/reports', validateQuery(canteenQuerySchema), canteenList);
router.get('/canteen/reports/:month', validateParams(monthParamSchema), canteenDetail);
router.get('/lost-found', validateQuery(lostFoundQuerySchema), lostFoundList);
router.get('/lost-found/:id', validateParams(idParamSchema), lostFoundDetail);
router.get('/lost-found/:id/images/:imageId', validateParams(itemImageParamSchema), lostFoundImage);
router.get('/mailbox/public', validateQuery(mailboxQuerySchema), mailboxList);
router.post('/query/status', publicQueryLimiter(), validateBody(queryStatusSchema), queryStatus);

router.post('/canteen-feedback', publicSubmissionLimiter(), publicAttachments, validateBody(canteenFeedbackSchema), createCanteenFeedback);
router.post('/lost-found/items', publicSubmissionLimiter(), publicAttachments, validateBody(lostFoundSubmissionSchema), createLostFoundItem);
router.post('/lost-found/items/:id/inquiries', publicSubmissionLimiter(), validateParams(idParamSchema), publicAttachments, validateBody(lostFoundInquirySchema), createLostFoundInquiry);
router.post('/mailbox', publicSubmissionLimiter(), publicAttachments, validateBody(mailboxSubmissionSchema), createMailboxMessage);

export default router;
