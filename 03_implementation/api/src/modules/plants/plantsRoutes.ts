import { Router } from 'express'
import { authenticate } from '../auth/authController.ts'
import {
  list,
  get,
  create,
  update,
  remove,
  logCare,
  getCareHistory,
  logGrowth,
  getGrowthHistory,
  removeGrowthEntry,
  searchSpecies,
} from './plantsController.ts'

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
// Growth photo timeline (FR-PLT-20/21, BR-PLT-24 cl.5).
router.post('/:id/growth', logGrowth)
router.get('/:id/growth', getGrowthHistory)
router.delete('/:id/growth/:entryId', removeGrowthEntry)
export default router
