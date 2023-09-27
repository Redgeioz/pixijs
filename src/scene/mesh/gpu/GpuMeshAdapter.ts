import { ExtensionType } from '../../../extensions/Extensions';
import { compileHighShaderGpuProgram } from '../../../rendering/high-shader/compileHighShaderToProgram';
import { localUniformBitGl } from '../../../rendering/high-shader/shader-bits/localUniformBit';
import { textureBitGl } from '../../../rendering/high-shader/shader-bits/textureBit';
import { Shader } from '../../../rendering/renderers/shared/shader/Shader';
import { Texture } from '../../../rendering/renderers/shared/texture/Texture';
import { color32BitToUniform } from '../../graphics/gpu/colorToUniform';

import type { WebGPURenderer } from '../../../rendering/renderers/gpu/WebGPURenderer';
import type { Renderable } from '../../../rendering/renderers/shared/Renderable';
import type { MeshAdaptor, MeshPipe } from '../shared/MeshPipe';
import type { MeshView } from '../shared/MeshView';

export class GpuMeshAdapter implements MeshAdaptor
{
    /** @ignore */
    public static extension = {
        type: [
            ExtensionType.WebGPUPipesAdaptor,
        ],
        name: 'mesh',
    } as const;

    private _shader: Shader;

    public init(): void
    {
        const gpuProgram = compileHighShaderGpuProgram({
            name: 'mesh',
            bits: [
                localUniformBitGl,
                textureBitGl,
            ]
        });

        this._shader = new Shader({
            gpuProgram,
            resources: {
                uTexture: Texture.EMPTY._source,
                uSampler: Texture.EMPTY._source.style,
            }
        });
    }

    public execute(meshPipe: MeshPipe, renderable: Renderable<MeshView>)
    {
        const renderer = meshPipe.renderer;
        const view = renderable.view;

        const state = view.state;

        state.blendMode = renderable.layerBlendMode;

        const localUniforms = meshPipe.localUniforms;

        localUniforms.uniforms.uTransformMatrix = renderable.layerTransform;
        localUniforms.update();

        color32BitToUniform(
            renderable.layerColor,
            localUniforms.uniforms.uColor,
            0
        );

        let shader: Shader = view._shader;

        if (!shader)
        {
            shader = this._shader;

            shader.groups[2] = (renderer as WebGPURenderer)
                .texture.getTextureBindGroup(view.texture);
        }

        // GPU..
        shader.groups[0] = renderer.globalUniforms.bindGroup;

        shader.groups[1] = (renderer as WebGPURenderer)
            .renderPipes.uniformBatch.getUniformBindGroup(localUniforms, true);

        renderer.encoder.draw({
            geometry: view._geometry,
            shader,
            state
        });
    }

    public destroy(): void
    {
        this._shader.destroy(true);
        this._shader = null;
    }
}