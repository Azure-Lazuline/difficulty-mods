sc.DifficultyModsIgnoreEnemies = new Set([
  'cargo-crab', 'cargo-crab-extra', 'turret-rhombus', 
  'pillar-large',
  'henry', 'henry-prop',
  'elboss-core',
  'driller', 'default-bot', 'icewall', 'aircon', 'oven',
  'dummy', 'target-bot-2'
]);

sc.CombatParams.inject({
	getStat(a, b) {
		var stat = this.parent(a, b);
		
		if(a=="hp"&&this.combatant!=null)
		{			
			if(this.combatant.party==sc.COMBATANT_PARTY.ENEMY)
			{
				if(this.combatant.difficultyModsScaledHP==null){
					//run once on enemy load
					
					var name = this.combatant.enemyName;
					if(name != null && name.includes('.')) //remove all before the last dot
					{
						name=name.substring(name.lastIndexOf('.')+1);
					}

					this.combatant.difficultyModsScaledHP = 1.0;
					if(!sc.DifficultyModsIgnoreEnemies.has(name))
					{
						this.combatant.difficultyModsScaledHP = sc.options.get("difficultymods-enemy-hp3");
						//also scale currentHP, since the arena's level-scaling is odd which makes this necessary there
						this.currentHp = Math.round(this.currentHp * this.combatant.difficultyModsScaledHP);
						
						//handle health bars
						this.combatant.statusGui.currentHp = Math.round(this.combatant.statusGui.currentHp * this.combatant.difficultyModsScaledHP);
						this.combatant.statusGui.targetHp = Math.round(this.combatant.statusGui.targetHp * this.combatant.difficultyModsScaledHP);
					}
				}
				//run every time the HP stat is requested, apply the cached multiplier
				stat = Math.round(stat * this.combatant.difficultyModsScaledHP);
			}			
		}

		return stat;
	},
});

//make burn have lessened effectiveness to compensate, since it's percentage-based otherwise
sc.BurnStatus.inject({
	activate(b, a, d){
		if(a && a.combatant && a.combatant.difficultyModsScaledHP)
			this.difficultyModsScaledHP = a.combatant.difficultyModsScaledHP;

		return this.parent(b, a, d);
	}
});
sc.BurnStatus.inject({
	getEffectiveness(b){
		var value = this.parent(b);
		if(this.difficultyModsScaledHP) value /= this.difficultyModsScaledHP;
		return value;
	}
});

//scale down damage-done and effective-damage in arena scores based on enemy HP,
//so you don't get a million extra points just from having the HP turned up
sc.Arena.inject({
	addScore(a, b){
		if(a == "DAMAGE_DONE" || a == "DAMAGE_DONE_EFFECTIVE"){
			b = Math.floor(b / sc.options.get("difficultymods-enemy-hp3"));
		}
		return this.parent(a, b);
	}
});

//increase the target time proportionally to enemy HP too, so you don't get locked out of half the gold medals if you turn HP up.
//this doesn't account for bosses with a lot of invulnerable time so those will technically be slightly easier to get medals on, but oh well
sc.Arena.inject({
	addBonusObjectives(){
		this.parent();
		var timebonus=this.runtime.bonusObjectives.find((element)=>element.type=="TIME");
		if(timebonus != null)
			timebonus.data._time = Math.floor(timebonus.data._time * sc.options.get("difficultymods-enemy-hp3"));

	}
});

//scale break meter based on HP (by getting the old and new break meters before/after each hit, and scaling the difference)
sc.ENEMY_TRACKER.HIT.inject({
	onConditionEval(b, a, d, c){
		var old = this.current;
		var result = this.parent(b, a, d, c);
		if(b.difficultyModsScaledHP)
			this.current = old + (this.current - old) / b.difficultyModsScaledHP;
		return result; //this returns true even if the scaled meter isn't quite full, as long as it *would've* been full from the unscaled hit.
		//i could fix this but i think it helps with object-triggered weaknesses like waveballs on the ghosts
	}
});