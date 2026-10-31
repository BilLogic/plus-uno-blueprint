// Use the published write surface. Copying its table mutations into a script
// would lose placement syncing and drift from the ledger's inverse shapes.
import * as cell from 'uno-blueprint/src/lib/cellContentMutations.ts'
import * as evidence from 'uno-blueprint/src/lib/evidenceMutations.ts'
import * as structure from 'uno-blueprint/src/lib/authoringRpc.ts'
import * as placement from 'uno-blueprint/src/lib/placementLinkMutations.ts'
import * as scenario from 'uno-blueprint/src/lib/scenarioSpecMutations.ts'
import * as step from 'uno-blueprint/src/lib/stepSpecMutations.ts'
import * as log from 'uno-blueprint/src/lib/authoringLog.ts'
import * as session from 'uno-blueprint/src/lib/authoringSession.ts'

export const modules = { cell, evidence, structure, placement, scenario, step, log, session }
