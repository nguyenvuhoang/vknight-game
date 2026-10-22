import type {HeroId,Level,GameNotice} from "../types";
import {getHero} from "../heroes";
type Controls={left:boolean;right:boolean;jump:boolean;interact:boolean;ability:boolean};
type Props={host:HTMLElement;hero:HeroId;level:Level;controls:Controls;onNotice:(n:GameNotice)=>void};
export async function createAdventure({host,hero,level,controls,onNotice}:Props){
 const Phaser=(await import("phaser")).default;
 const chosen=getHero(hero);
 class AdventureScene extends Phaser.Scene{
  player!:Phaser.Physics.Arcade.Sprite;
  cursors!:Phaser.Types.Input.Keyboard.CursorKeys;
  keys!:Record<string,Phaser.Input.Keyboard.Key>;
  done=false;npcVisited=false;locked=false;abilityCooldown=0;wasInteract=false;wasAbility=false;wasJump=false;respawnAt=0;
  constructor(){super("Adventure")}
  preload(){this.load.image("hero",chosen.asset)}
  create(){
   this.cameras.main.setBackgroundColor(level.bg);
   this.physics.world.setBounds(0,0,level.width,650);
   const g=this.add.graphics();
   g.fillStyle(0xfff3d1,.8);g.fillCircle(740,95,54);
   for(let x=0;x<level.width;x+=300){
    g.fillStyle(0xa1c996,.7);g.fillEllipse(x+90,410,390,170);
    g.fillStyle(0x78b17d,.6);g.fillEllipse(x+250,440,420,155);
   }
   const ground=this.physics.add.staticGroup();
   for(const p of level.platforms){
    const platform=this.add.rectangle(p.x,p.y,p.w,p.h,0x5d9c56).setStrokeStyle(3,0x3c7342);
    this.add.rectangle(p.x,p.y+p.h/2-3,p.w,9,0x715337);
    this.physics.add.existing(platform,true);ground.add(platform);
   }
   for(const h of level.hazards){
    this.add.triangle(h.x,h.y,0,h.h,h.w/2,0,h.w,h.h,0xc23e43).setStrokeStyle(2,0x7e262e);
   }
   this.add.text(24,22,"CHAPTER 1 · LÀNG NGÁO",{fontFamily:"Arial",fontSize:"17px",color:"#2d3e31",fontStyle:"bold"}).setScrollFactor(0).setDepth(30);
   const npcX=level.npc.x;
   this.add.circle(npcX,level.groundY-45,16,0xf2b581).setStrokeStyle(2,0x684b31);
   this.add.rectangle(npcX,level.groundY-18,23,32,0xa65d50);
   this.add.text(npcX-65,level.groundY-109,level.npc.name,{fontFamily:"Arial",fontSize:"15px",color:"#24322a",backgroundColor:"#fff2c9",padding:{x:6,y:4}});
   this.add.text(level.exitX-28,level.groundY-130,"ĐÍCH →",{fontFamily:"Arial",fontSize:"19px",fontStyle:"bold",color:"#fff",backgroundColor:"#35715a",padding:{x:8,y:5}});
   this.add.rectangle(level.exitX,level.groundY-52,12,104,0x4b7952);
   this.add.triangle(level.exitX+22,level.groundY-97,0,0,50,22,0,42,0xebbb48);
   this.player=this.physics.add.sprite(level.spawn.x,level.spawn.y,"hero");
   this.player.setDisplaySize(75,103).setOrigin(.5,1).setCollideWorldBounds(false);
   this.player.body?.setSize(24,64).setOffset(25,37);
   this.physics.add.collider(this.player,ground);
   this.cameras.main.startFollow(this.player,true,.12,.12);
   this.cameras.main.setBounds(0,0,level.width,540);
   this.keys=this.input.keyboard!.addKeys("A,D,W,SPACE,E,F,R") as Record<string,Phaser.Input.Keyboard.Key>;
   this.cursors=this.input.keyboard!.createCursorKeys();
   onNotice({kind:"message",text:level.story});
  }
  update(time:number){
   if(this.done)return;
   const k=this.keys;const body=this.player.body as Phaser.Physics.Arcade.Body;
   const left=k.A.isDown||this.cursors.left.isDown||controls.left;
   const right=k.D.isDown||this.cursors.right.isDown||controls.right;
   body.setVelocityX(left?-225:right?225:0);
   this.player.setFlipX(left);
   const jump=Phaser.Input.Keyboard.JustDown(k.SPACE)||Phaser.Input.Keyboard.JustDown(k.W)||Phaser.Input.Keyboard.JustDown(this.cursors.up)||controls.jump&&!this.wasJump;
   this.wasJump=controls.jump;
   if(jump&&body.blocked.down)body.setVelocityY(-465);
   const interact=Phaser.Input.Keyboard.JustDown(k.E)||(controls.interact&&!this.wasInteract);this.wasInteract=controls.interact;
   if(interact&&Math.abs(this.player.x-level.npc.x)<100){
    this.npcVisited=true;onNotice({kind:"npc",text:`${level.npc.name}: ${level.npc.lines[hero]}`});
    this.add.text(level.npc.x,level.groundY-140,"✓",{fontSize:"36px",color:"#247d43"}).setOrigin(.5).setDepth(5);
   }
   const ability=Phaser.Input.Keyboard.JustDown(k.F)||(controls.ability&&!this.wasAbility);this.wasAbility=controls.ability;
   if(ability&&time>this.abilityCooldown){this.abilityCooldown=time+1500;
     const label=this.add.text(this.player.x,this.player.y-110,chosen.ability+"!",{fontSize:"18px",color:"#cc4e20",fontStyle:"bold",backgroundColor:"#fff3d7",padding:{x:6,y:4}}).setOrigin(.5);
     this.tweens.add({targets:label,y:label.y-55,alpha:0,duration:800,onComplete:()=>label.destroy()});
     if(Math.abs(this.player.x-level.npc.x)<100){this.npcVisited=true;onNotice({kind:"npc",text:`${chosen.name} dùng ${chosen.ability}! ${level.npc.lines[hero]}`})}
   }
   for(const h of level.hazards){if(Math.abs(this.player.x-h.x)<h.w/2+12&&this.player.y>h.y-h.h-6&&this.player.y<h.y+h.h+42){this.die();return}}
   if(this.player.y>570){this.die();return}
   if(this.player.x>=level.exitX){if(level.npc.required&&!this.npcVisited){onNotice({kind:"message",text:"Khoan! Phải nói chuyện với NPC trước khi qua ải. Nhấn E khi đứng gần."});this.player.setX(level.exitX-35);body.setVelocityX(0)}else{this.done=true;this.physics.pause();onNotice({kind:"win",text:`QUA ẢI! ${chosen.name} đã vượt qua “${level.title}”. Dân làng không hiểu chuyện gì vừa xảy ra.`})}}
  }
  die(){this.done=true;this.physics.pause();onNotice({kind:"death",text:"TOANG! Bạn đã thất bại. Nhấn R để chơi lại hoặc trở về Menu và chọn lại ải."});this.input.keyboard!.once("keydown-R",()=>this.scene.restart())}
 }
 const game=new Phaser.Game({type:Phaser.AUTO,parent:host,width:960,height:540,backgroundColor:level.bg,scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},physics:{default:"arcade",arcade:{gravity:{x:0,y:1050},debug:false}},scene:[AdventureScene],render:{pixelArt:false,antialias:true}});
 return game;
}
