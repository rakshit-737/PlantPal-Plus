import type { NextFunction, Request, Response } from 'express'

import { getUserId } from '../../http/requestUser.js'

import { listForUser, listStreaks, markSeen } from './achievementsRepo.js'

export async function listAchievementsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const items = await listForUser(userId)
    res.status(200).json(items)
  } catch (err) {
    next(err)
  }
}

export async function listStreaksHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const streaks = await listStreaks(userId)
    res.status(200).json({ streaks })
  } catch (err) {
    next(err)
  }
}

export async function markSeenHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = getUserId(req)
    const updated = await markSeen(userId)
    res.status(200).json({ marked_seen: updated })
  } catch (err) {
    next(err)
  }
}
