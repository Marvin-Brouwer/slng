import type { BaseNodeWithoutComments } from 'estree'

/* eslint-disable @typescript-eslint/no-empty-object-type */

/** This is just {@link BaseNodeWithoutComments}, re-exported so extensions don't need to install `estree` */
export interface SlingNode extends BaseNodeWithoutComments {}
