# Token Light Condition

![GitHub release](https://img.shields.io/github/v/release/Sayshal/tokenlightcondition?style=for-the-badge)
![GitHub Downloads (specific asset, all releases)](https://img.shields.io/github/downloads/Sayshal/tokenlightcondition/module.zip?style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Total)&color=ff144f)
![GitHub Downloads (specific asset, latest release)](https://img.shields.io/github/downloads/Sayshal/tokenlightcondition/latest/module.zip?sort=date&style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Latest)&color=ff144f)

![Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FFrstrm%2FTokenLightCondition%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
![D&D5E Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fsystem%3FnameType%3Dfoundry%26showVersion%3D1%26style%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FFrstrm%2FTokenLightCondition%2Freleases%2Flatest%2Fdownload%2Fmodule.json)

## Supporting The Module

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/sayshal)

## Introduction

**Token Light Condition** revolutionizes lighting mechanics in FoundryVTT! Automatically detect and visualize your characters' lighting conditions with intelligent automation that handles everything from simple torch placement to complex magical darkness scenarios. Never again wonder whether your rogue has advantage on stealth or if your spell requires bright light—Token Light Condition tracks it all seamlessly.

Say goodbye to manual lighting calculations and forgotten visibility rules. **Token Light Condition** handles the complexity so you can focus on the adventure!

---

## Key Features

### 🌟 **Intelligent Lighting Detection**

- **Automatic Calculations**: Real-time detection of bright, dim, and dark lighting conditions
- **Visual Effects**: Clear status effects applied to tokens in dim or dark conditions
- **Smart Wall Detection**: Properly handles light blocked by walls and obstacles
- **Complex Light Sources**: Support for angled lights, elevation differences, and rotating light sources

### 🎭 **Enhanced Token Management**

- **HUD Indicators**: Quick visual reference showing DRK, DIM, or BRT status on token selection
- **Living Tokens Only**: Automatically filters to characters and NPCs with HP > 0
- **Multi-Token Updates**: Efficiently processes lighting changes across entire scenes
- **Effect Integration**: Seamlessly works with ActiveEffects and status condition systems

### 🎯 **Advanced Lighting Features**

- **Global Illumination Support**: Respects scene-wide lighting settings with intelligent overrides
- **Negative Light Sources**: Experimental support for darkness-creating light sources
- **3D Elevation Awareness**: Moderate support for Levels and 3D elevation systems
- **Magical Darkness Areas**: Integration with drawing tools to create light-blocking regions
- **Angled Light Precision**: Accurate calculations for directional and cone lighting

### 🛠️ **Powerful GM Controls**

- **One-Click Toggle**: Easy enable/disable control directly in the lighting toolbar
- **Flexible Enforcement**: Choose between automatic effects or tracking-only modes
- **Performance Optimization**: Configurable delay systems for large scenes
- **Rule Customization**: Fine-tune lighting behavior to match your campaign needs

---

## Installation

Get Token Light Condition through Foundry's **Module Manager** for instant setup.

### Manual Installation

1. Open **Foundry's Configuration and Setup** screen
2. Click **Install Module** in the Add-on Modules section
3. Paste this URL in the **Manifest URL** field:

[https://github.com/Sayshal/tokenlightcondition/releases/latest/download/module.json](https://github.com/Sayshal/tokenlightcondition/releases/latest/download/module.json)

4. Click **Install**
5. Enable Token Light Condition in the **Manage Modules** section

---

## Player Features

### Instant Lighting Awareness

Never lose track of your character's lighting situation:

- **Visual Status Effects**: Automatic Dark and Dim condition effects applied to your token
- **Quick HUD Reference**: Right-click any token to see its current lighting status (DRK, DIM, BRT)
- **Real-Time Updates**: Lighting conditions update automatically as you move or lights change
- **Clear Visual Feedback**: Distinct effects help you immediately understand tactical advantages

### Seamless Integration

Token Light Condition works behind the scenes:

- **No Manual Tracking**: Lighting conditions update automatically with movement and environmental changes
- **Rules-Accurate**: Proper implementation of visibility and lighting mechanics
- **Effect Compatibility**: Integrates with your existing status effect systems
- **Performance Optimized**: Smooth operation even in complex lighting scenarios

---

## GM Features

### Effortless Scene Management

Take control of lighting across your entire scene:

- **Master Toggle**: Enable or disable the system with one click from the lighting controls
- **Bulk Processing**: Automatically update all tokens when lighting conditions change
- **Scene Integration**: Responds to ambient light changes, darkness level adjustments, and global illumination
- **Token Filtering**: Smart detection ensures only relevant tokens are processed

### Advanced Configuration Options

Customize the system to match your campaign needs:

- **Effect Control**: Choose between full effects, tracking-only, or complete disable modes
- **Global Illumination**: Configure how scene-wide lighting interacts with local light sources
- **Performance Tuning**: Adjust calculation delays for optimal performance in large scenes
- **Experimental Features**: Enable negative light support and advanced 3D calculations

### Professional Tools

Access advanced lighting features:

- **Wall-Aware Calculations**: Proper line-of-sight blocking for realistic lighting
- **Elevation Support**: 3D distance calculations for multi-level environments
- **Angled Light Mastery**: Precise calculations for directional and cone lighting effects
- **Drawing Integration**: Use drawing tools to create areas of magical darkness or light restriction

---

## Configuration

### Quick Setup

1. **Enable the Module**: Activate Token Light Condition in your module settings
2. **Choose Display Options**: Decide whether to show token HUD indicators
3. **Configure Effects**: Select between full effects or tracking-only mode
4. **Set Performance Options**: Adjust delay settings for your scene complexity

### Advanced Options

Fine-tune the system through comprehensive settings:

- **Show TokenHUD**: Toggle the display of lighting indicators on token selection
- **Add Token Effects**: Enable or disable automatic status effect application
- **Global Illumination**: Control how scene lighting interacts with local sources
- **Delay Calculations**: Add processing delays for performance optimization (0-3000ms)
- **Negative Lights Support**: Experimental feature for darkness-creating light sources

---

## System Compatibility

### Supported Systems

- **D&D 5e System**: Full integration with official D&D 5e mechanics and status effects
- **Pathfinder 2e**: Basic compatibility (V13 compatibility not guaranteed - please report issues)

### Integration Support

- **Chris's Premades**: Automatic integration with the Effect Interface system
- **Levels/3D Maps**: Moderate support for elevation-based lighting (please report bugs)
- **Tidy5e Sheets**: Compatible with enhanced character sheet layouts
- **Wall Modules**: Works with advanced wall and terrain systems

---

## Why Token Light Condition?

Token Light Condition transforms lighting from a forgotten rule to an engaging tactical element. Instead of:

- Manually calculating lighting conditions for every token movement
- Forgetting to apply dim light penalties or darkness effects
- Struggling with complex lighting scenarios and rule lookups
- Losing track of which characters can see in various conditions

You get a comprehensive automation system that:

- **Handles Complexity Automatically**: From simple torches to magical darkness, every scenario is calculated correctly
- **Provides Instant Feedback**: Visual effects and indicators make lighting conditions immediately clear
- **Scales With Your Needs**: Works equally well for simple tavern scenes and complex multi-level dungeons
- **Enhances Tactical Play**: Players can make informed decisions about positioning and spell usage

Whether you're running a gritty dungeon crawl where every torch matters or an epic battle with magical lighting effects, Token Light Condition ensures lighting rules enhance rather than hinder your gameplay!

---

## Known Limitations

- **PF2e V13 Compatibility**: Not fully guaranteed for Foundry V13 - please report any issues
- **3D Map Support**: Moderate support for elevation systems - bug reports appreciated
- **Negative Lights**: Experimental feature that may need refinement based on usage
- **Performance**: Large scenes with many light sources may benefit from delay configuration

---

## Support & Community

- **GitHub Issues**: [Report bugs or request features](https://github.com/Sayshal/tokenlightcondition/issues)
- **Ko-fi**: [Support continued development](https://ko-fi.com/sayshal)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Original module by [Frstrm](https://github.com/Frstrm/TokenLightCondition), continued with permission.
