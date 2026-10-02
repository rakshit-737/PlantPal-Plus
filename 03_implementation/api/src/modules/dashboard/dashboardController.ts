import type { NextFunction, Request, Response } from 'express'

import { getUserId } from '../../http/requestUser.ts'
import { getDashboard } from './dashboardRepo.ts'

function todayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export async function getDashboardHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const date = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
      ? req.query.date
      : todayUtcDateStr()
    const userId = getUserId(req)
    const data = await getDashboard(userId, date)
    res.status(200).json(data)
  } catch (err) {
    next(err)
  }
}
