/**
 * Used to perform line transformation calculations without needing
 * to redeclare variables
 */
function LineTransformer() {
	this.displacementX = 0;
	this.displacementY = 0;
	this.lineLength = 0;
	this.referenceAngle = 0;
	this.rotateAngle = 0;
}

/**
 * Given a THREE.Line mesh object with geometry such that it points from (0, 0, 0) to 
 * (1, 0, 0), format it so that it now forms a line segment from (x1, y1) to (x2, y2).
 */
LineTransformer.prototype.transform = function(lineMesh, x1, y1, x2, y2) {
	this.displacementX = 1;
	
	this.displacementX = x2 - x1;
	this.displacementY = y2 - y1;
	
	this.lineLength = Math.sqrt(this.displacementX * this.displacementX 
		+ this.displacementY * this.displacementY);
	
	
	// Find the reference angle between displacement and the x axis
	// dot product against unit x vector
	this.referenceAngle = Math.acos(this.displacementX / this.lineLength);
	
	if (this.displacementY >= 0) {
		this.rotateAngle = this.referenceAngle;
	} else {
		this.rotateAngle = 2 * Math.PI - this.referenceAngle;
	}
	
	lineMesh.scale.x = this.lineLength;
	lineMesh.position.x = x1;
	lineMesh.position.y = y1;
	lineMesh.rotation.z = this.rotateAngle;
};