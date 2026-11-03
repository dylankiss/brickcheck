# BrickCheck

Checking a LEGO set against a pile of loose pieces, part by part, alone or together, to find out what's missing.

## Language

### Sets and parts

**Set**:
A LEGO product from the catalog, identified by its set number, such as 40516-1.
_Avoid_: Kit, model

**Part**:
One shape in one color, such as a red 2x4 brick. Its part number names the shape and is shared by every color.
_Avoid_: Element, tile, item, brick, design, mould

**Piece**:
One physical object in your hand. A Part needs some number of Pieces; "piece" is only used for counting.
_Avoid_: Brick, unit

**Spare**:
An additional Piece of a Part that LEGO puts in the box on top of what the Set needs.
_Avoid_: Extra

**Minifigure part**:
A Part that belongs to one of the Set's minifigures rather than to the build itself.
_Avoid_: Fig part, minifig piece

### Checks and people

**Check**:
One sorting session for one physical copy of a Set. Two copies of the same Set means two Checks.
_Avoid_: Session, inventory, project, sort

**Owner**:
The person who created a Check. They can do everything a Helper can, and only they can invite people, change roles, remove members or delete the Check.
_Avoid_: Admin, creator

**Helper**:
A member of a Check who can tick off parts and rename the Check.
_Avoid_: Editor, collaborator, contributor

**Viewer**:
A member of a Check who can follow progress but not tick off parts.
_Avoid_: Spectator, guest, read-only member

**Invite**:
A link the Owner shares to let someone join a Check as a Helper or a Viewer, until it expires or the Owner revokes it. It never changes the role of someone who is already a member.
_Avoid_: Share link, join link

### Inventory and progress

**Inventory line**:
One line of a set's inventory: a part, its quantity, whether it's a spare, and the minifigure it belongs to, if any. The same part can appear on several lines.
_Avoid_: Row, set part

**Found**:
How many Pieces of a Part someone has ticked off in a Check. "Tick off" is the action; found is the state.
_Avoid_: Checked, ticked, collected

**Missing**:
Needed minus found, counted only over the inventory lines the Check includes. A spare isn't missing in a Check that leaves spares out.
_Avoid_: Lacking, lost, remaining

**Complete**:
A Check with nothing missing. It's a fact, not something anyone declares.
_Avoid_: Done, finished, closed
