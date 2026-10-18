'use strict';
// Native positive-export acquisition for the creator's explicit preflight step.
// Fail with the visible report instead of auto-approving blocking errors.
module.exports=async function confirmNativeExport(page,selector){
 await page.locator(selector).click();
 await page.locator('#export-preflight-dialog').waitFor({state:'visible'});
 const confirm=page.locator('#export-preflight-confirm');
 if(!await confirm.isEnabled())throw new Error('Native export preflight refused: '+await page.locator('#export-preflight-dialog').innerText());
 await confirm.click();
};
