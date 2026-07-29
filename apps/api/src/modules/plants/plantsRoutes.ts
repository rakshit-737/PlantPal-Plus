import { Router } from 'express'
import { authenticate } from '../auth/authController.ts'
import { list, get, create, update, remove, logCare, getCareHistory, searchSpecies } from './plantsController.ts'

const router = Router()
router.use(authenticate)
router.get('/species', searchSpecies)
router.get('/', list)
router.post('/', create)
router.get('/:id', get)
router.put('/:id', update)
router.delete('/:id', remove)
router.post('/:id/care', logCare)
router.get('/:id/care', getCareHistory)
export default router
