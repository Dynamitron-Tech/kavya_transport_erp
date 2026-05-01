# Kavya Transports 3D

## Asset Pipeline

### First-time setup
Place source GLB masters in public/assets/source/
Run: npm run assets:optimize

### On new truck model
Replace public/assets/source/tr-final.glb
Run: npm run assets:truck

### On new environment
Replace public/assets/source/kavya-env.glb
Run: npm run assets:env

### Automatic
Assets are re-optimized automatically before every build (prebuild hook).
CI optimizes and commits on push if source files change.
