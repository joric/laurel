// based on https://github.com/urtzurd/html-audio

PitchShifter = function(audioContext) {
	let pitchShifterProcessor,
	validGranSizes = [256, 512, 1024, 2048, 4096, 8192],
	grainSize = validGranSizes[1],
	pitchRatio = 1.0,
	overlapRatio = 0.50,
	bypass = false,

	hannWindow = function(length) {
		let window = new Float32Array(length);
		for (let i = 0; i < length; i++) {
			window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
		}
		return window;
	},

	linearInterpolation = function(a, b, t) {
		return a + (b - a) * t;
	},

	initProcessor = function () {

		if (pitchShifterProcessor) {
			pitchShifterProcessor.disconnect();
		}

		if (audioContext.createScriptProcessor) {
			pitchShifterProcessor = audioContext.createScriptProcessor(grainSize, 1, 1);
		} else if (audioContext.createJavaScriptNode) {
			pitchShifterProcessor = audioContext.createJavaScriptNode(grainSize, 1, 1);
		}

		pitchShifterProcessor.buffer = new Float32Array(grainSize * 2);
		pitchShifterProcessor.grainWindow = hannWindow(grainSize);
		pitchShifterProcessor.pitchRatio = pitchRatio;
		pitchShifterProcessor.bypass = bypass;

		pitchShifterProcessor.onaudioprocess = function (event) {

			let pitchRatio = pitchShifterProcessor.pitchRatio;
			let inputData = event.inputBuffer.getChannelData(0);
			let outputData = event.outputBuffer.getChannelData(0);

			if (pitchShifterProcessor.bypass) {
				for (i = 0; i < inputData.length; i++) {
					outputData[i] = inputData[i];
				}
				return;
			}

			// Apply the window to the input buffer
			for (i = 0; i < inputData.length; i++) {
				// Apply the window to the input buffer
				inputData[i] *= this.grainWindow[i];
				// Shift half of the buffer
				this.buffer[i] = this.buffer[i + grainSize];
				// Empty the buffer tail
				this.buffer[i + grainSize] = 0.0;
			}

			// Calculate the pitch shifted grain re-sampling and looping the input
			let grainData = new Float32Array(grainSize * 2);
			for (let i = 0, j = 0.0;
				i < grainSize;
				i++, j += pitchRatio) {
				let index = Math.floor(j) % grainSize;
				let a = inputData[index];
				let b = inputData[(index + 1) % grainSize];
				grainData[i] += linearInterpolation(a, b, j % 1.0) * this.grainWindow[i];
			}

			// Copy the grain multiple times overlapping it
			for (i = 0; i < grainSize; i += Math.round(grainSize * (1 - overlapRatio))) {
				for (j = 0; j <= grainSize; j++) {
					this.buffer[i + j] += grainData[j];
				}
			}

			// Output the first half of the buffer
			for (i = 0; i < grainSize; i++) {
				outputData[i] = this.buffer[i];
			}
		}
	};

	initProcessor();
	return pitchShifterProcessor;
}

