import { Router } from 'express';
import { deleteNews, loginPost, uploadMedia, viewNewsCreated } from '../Controllers/subAdmin.controller.js';
import { verifyToken } from '../Middlewares/createNewsAuth.js';


const router = Router();

router.post("/login",loginPost)
router.post("/upload",verifyToken,uploadMedia)
router.get("/viewNewsArticles",verifyToken,viewNewsCreated)
router.delete("/deleteNews/:articleId",verifyToken,deleteNews)

export default router;
