import { writeFileSync } from 'node:fs'
import { renderSiteConfigSql, SITE_CONFIG_SQL_FILE } from '../lib/site-config/sql'

writeFileSync(new URL(`../${SITE_CONFIG_SQL_FILE}`, import.meta.url), renderSiteConfigSql(), 'utf8')
console.log('escrito', SITE_CONFIG_SQL_FILE)
