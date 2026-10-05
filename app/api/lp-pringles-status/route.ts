import { createLpPublicationStatusHandlers } from '@/app/lib/lpPublicationStatus'

// Public read-only projection for the approved PRINGLES LP catalog.
// ColorMe credentials and all unrelated product data remain server-side.
export const dynamic = 'force-dynamic'
export const maxDuration = 30

const PRODUCT_IDS = ["193763294","193763293","193763292","193763291","193763290","193763289","193763288","193763286","193763285","193763284","193763283","193763282","193763281","193763280","193763279","193763278","193763276","192660366","192660289","192660145","192660113","192653348","192653240","191955294","191955287","191955279","191955253","191955248","191955240","191955227","191955223","191955201","191955181","191955163","191955157","191955080","191955068","191955057","191955047","191954926"]

export const { GET, OPTIONS } = createLpPublicationStatusHandlers(PRODUCT_IDS)
