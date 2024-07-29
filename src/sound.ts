import CPlayer from './audio-player'
import { song2 } from './songs'

export type SoundPlay = {
  generate: () => Promise<void>,
  play: (name: string, loop?: boolean) => (() => void) | undefined
}


export default sound_play()

function sound_play(): SoundPlay {

    let ctx = new AudioContext(),
        audioMaster = ctx.createGain();

    audioMaster.connect(ctx.destination);

    const sounds: Record<string, AudioBuffer> = {};

    const addSound = (name: string, buffer: AudioBuffer) => {
        sounds[name] = buffer;
    };

    const data = [
        { name: 'song', data: song2 },
    ];

    const generate = () => {

        data.forEach(o => {
            let generator = new CPlayer();
            generator.init(o.data);
            function step() {
                if (generator.generate() === 1) {
                    let buffer = generator.createAudioBuffer(ctx)
                    addSound(o.name, buffer);
                } else {
                    setTimeout(step, 0);
                }
            }
            step();
        });

        return new Promise<void>(resolve => {
            function check() {
                if (Object.keys(sounds).length === data.length) {
                    resolve();
                    return;
                }
                setTimeout(check, 100);
            }
            check();
        });
    };



    const playSound = (name: string, loop = false) => {
        const buffer = sounds[name];

        if (!buffer) {
            return undefined;
        }

        let source = ctx.createBufferSource(),
            gainNode = ctx.createGain()

        source.buffer = buffer;
        source.connect(gainNode);
        gainNode.connect(audioMaster);

        source.loop = loop;
        gainNode.gain.value = 0.8;
        source.start();
        return () => {
            source.stop()
        }
    };

    return { generate, play: playSound }
}