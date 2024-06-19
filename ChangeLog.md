### Version 0.7.0
* module support removal
* * removed support for Perfect Vision ( not updated to v11 )
* * removed support for Combat Utility Belt ( not updated to v11 )
* * attempted to clean up some version deprecation warnings

### Version 0.6.5
* pf2e
* * slugs updated for dim/darkness
* * rules options added for dim/darkness

### Version 0.6.4
* Options added
* * allows for lights setup with -luminance
* * Calculation Delay

### Version 0.6.3
* Restored effects option to config for pf2e system
* * pf2e is not dependent on ATL to add effects to token

### Version 0.6.2
* Fix: config change disabled pf2e effects

### Version 0.6.1
* Core Version updated to support 11
* Updated wall collision check to newer methods
* Changed effects check for ATL module, this impacts config settings

### Version 0.6.0
* remove experimental state of Global Illumincation setting.
* added system pf2e
* * creates item effects on initialization
* * accounts for actor item effects usage on token

### Version 0.5.4
* experimental option for using Scene Global Illumination settings

### Version 0.5.3
* Fix for isValidActor checks
* Additional armoring around isValidActor and hp checks

### Version 0.5.2
* Check on token light sources now account for Angles and Rotation.
* * Example: on use of a bullseye lattern by a player.

### Version 0.5.1
* Check on light placements now account for Angles and Rotation.

### Version 0.5.0
* Add icon to Lighting Controls that enable/disables Token Light Condition
* * On Enable (default): a pass will be made on tokens to check for needed effects
* * On Disable: A pass will be made on tokens to remove Dim/Dark effects
* * Give the module time when switching modes to process the tokens.
* Added armor around adding/removing effects to reduce an edge case of multiple effects being applied.
* Added ability to trigger ui notifications via method.

### Version 0.4.0
* Optimize find_token_lighting workflow
* * Reduce wallcollision checks until needed.
* * Opt out of further checks if Bright is determined.
* * ( This should improve overall performance )
* BugFix: 13: Cleaned up module.json: links, and system usage

### Version 0.3.4
* Potential bugfix for effect not getting removed.

### Version 0.3.3
* Add Option to enable/disable the TokenHud display.

### Version 0.3.2
* Detecting Token is in a drawing with darkness overrides (perfect-vision)
* Attempt to account for light elevation (levels)

### Version 0.3.1
* variable assignment fix

### Version 0.3.0
* Distance calculations now account for elevation (token, lights)
* Effects are now updated on lightingRefresh
* Added armor around updates and token checks
* Effects are removed if at 0 hp.
* TokenHud light indicator is not show at 0 hp.

### Version 0.2.0
* Added option to select effect source.
* * none, Active Effect, CUB, Convenient Effect
* * CUB option is only visible if Dark AND Dim exist as conditions in Lab
* Cleaned up and optimized how effects were being removed.
* Updated Icon image selection used for effects
* * IF effects already exist in CE, they are not replaced/updated.
* * You can clear them from CE, and they will be regenerated on reload.
* Moved effects functions into their own script

### Version 0.1.0
* Updates effects on tokens on scene Darkness Level changes.
* Updates effects on tokens when dropped into scene.

### Version 0.0.2
* formatting fixup
* fixed some issue around clearing effects when moving to Bright lighting condition.

### Version 0.0.1
* Initial implementation