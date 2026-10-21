Pod::Spec.new do |s|
  s.name           = 'SimpleFitHTTPCache'
  s.version        = '1.0.0'
  s.summary        = 'Keeps SimpleFit API responses out of the iOS HTTP disk cache (SF-70).'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'SimpleFit'
  s.homepage       = 'https://simplefit.invalid'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'Expo'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
