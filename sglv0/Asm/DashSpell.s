.include "z2r.inc"

.segment "PRG0"

; Update the magic table to point to an rts
; (Unlike the Fire spell, the Dash spell executes no code when cast)
.org $8e50
  .word ($9814)

; Inside Links_Acceleration_Routine, patch the max speed compare to check if we cast dash  
.org $93ff
  jsr ReplaceFireWithDashSpell

.reloc
ReplaceFireWithDashSpell:
  pha
  lda FireSpellActive ; Current magic state
  and #$10  ; fire is on
  bne @HasFire
    pla
    cmp $93b3,y ; Table for Link's original max velocities
    rts
@HasFire:
  pla
  cmp @SecondaryVelocityTable,y
  rts
@SecondaryVelocityTable:
.byte $30, $d0


; Patch Fairy movement in a similar fashion
.if FasterDashFairy
.org $931e
  jsr GetFairyHorizontalVelocity

.reloc
GetFairyHorizontalVelocity:
  lda $076f          ; Current magic state
  and #$10
  beq @Done          ; fire bit is not set
  tya
@CheckRight:
  ror
  bcc @CheckLeft     ; right is not pressed
  lda #$24
  rts
@CheckLeft:
  ror
  bcc @Done          ; left is not pressed
  lda #$dc
  rts
@Done:
  lda $92aa,y        ; load original value
  rts
.endif ; FasterDashFairy
